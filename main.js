const { Plugin, PluginSettingTab, Setting, Notice, requestUrl } = require("obsidian");

const DEFAULT_SETTINGS = {
  serviceKey: "",
  autoRefreshSeconds: 0,
};

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function parseBusBlock(source) {
  const result = { routes: [], refreshSeconds: 60 };
  let listKey = null;

  for (const rawLine of source.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    if (line.startsWith("- ") && listKey) {
      result[listKey].push(line.slice(2).trim());
      continue;
    }

    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();

    if (key === "routes") {
      listKey = "routes";
      if (value) result.routes = value.split(",").map((item) => item.trim()).filter(Boolean);
    } else {
      listKey = null;
      result[key] = value;
    }
  }

  result.stopId = String(result.stopId || "").trim();
  result.stopName = String(result.stopName || result.stopId || "정류장").trim();
  result.refreshSeconds = Number(result.refreshSeconds) || 60;
  return result;
}

function getMessageBody(json) {
  return json && json.response && json.response.msgBody
    ? json.response.msgBody
    : json && json.msgBody
      ? json.msgBody
      : null;
}

function getApiError(json) {
  const header = json && json.response && json.response.comMsgHeader
    ? json.response.comMsgHeader
    : json && json.comMsgHeader
      ? json.comMsgHeader
      : null;
  if (!header) return null;
  const code = header.returnCode || header.errMsg;
  if (!code || String(code) === "0" || String(code).toUpperCase() === "NORMAL SERVICE.") return null;
  return header.errMsg || header.returnMessage || String(code);
}

class BusArrivalSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Bus Arrival 설정" });

    new Setting(containerEl)
      .setName("공공데이터포털 일반 인증키 (Decoding)")
      .setDesc("Markdown 문서가 아닌 이 플러그인의 로컬 data.json에 저장됩니다.")
      .addText((text) => {
        text.inputEl.type = "password";
        text
          .setPlaceholder("인증키 입력")
          .setValue(this.plugin.settings.serviceKey)
          .onChange(async (value) => {
            this.plugin.settings.serviceKey = value.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("자동 갱신 주기")
      .setDesc("모든 버스 도착정보 블록에 적용됩니다. '문서 값 사용'일 때만 refreshSeconds를 사용합니다.")
      .addDropdown((dropdown) => dropdown
        .addOption("0", "자동 갱신 끄기")
        .addOption("60", "1분")
        .addOption("300", "5분 (권장)")
        .addOption("600", "10분")
        .addOption("1800", "30분")
        .addOption("-1", "문서의 refreshSeconds 사용")
        .setValue(String(this.plugin.settings.autoRefreshSeconds))
        .onChange(async (value) => {
          this.plugin.settings.autoRefreshSeconds = Number(value);
          await this.plugin.saveSettings();
          this.plugin.rescheduleAutoRefresh();
        }));
  }
}

module.exports = class BusArrivalPlugin extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.routeNameCache = new Map();
    this.arrivalCache = new Map();
    this.autoRefreshSchedulers = new Set();
    this.addSettingTab(new BusArrivalSettingTab(this.app, this));

    this.registerMarkdownCodeBlockProcessor("bus-arrival", async (source, el, ctx) => {
      const config = parseBusBlock(source);
      const root = el.createDiv({ cls: "bus-arrival" });
      const header = root.createDiv({ cls: "bus-arrival__header" });
      header.createEl("strong", { text: `🚌 ${config.stopName}` });
      const refreshButton = header.createEl("button", { text: "새로고침", cls: "bus-arrival__refresh" });
      const status = root.createDiv({ cls: "bus-arrival__status" });
      const list = root.createDiv({ cls: "bus-arrival__list" });
      let disposed = false;
      let loading = false;
      let timer = null;

      const render = async () => {
        if (disposed || loading) return;
        if (!config.stopId) {
          status.setText("정류소 ID가 없습니다.");
          return;
        }
        if (!this.settings.serviceKey) {
          status.setText("설정 → Bus Arrival에서 공공데이터포털 인증키를 입력하세요.");
          return;
        }

        loading = true;
        refreshButton.disabled = true;
        status.setText("도착정보를 불러오는 중…");
        try {
          const stationId = await this.resolveStationId(config.stopId, config.stopName);
          const arrivals = await this.fetchArrivals(stationId);
          const enriched = await Promise.all(arrivals.map(async (arrival) => ({
            ...arrival,
            routeName: await this.fetchRouteName(arrival.routeId),
          })));
          const routeSet = new Set(config.routes.map((route) => route.toLowerCase()));
          const filtered = routeSet.size
            ? enriched.filter((arrival) => routeSet.has(String(arrival.routeName).toLowerCase()))
            : enriched;

          list.empty();
          if (!filtered.length) {
            list.createDiv({ cls: "bus-arrival__empty", text: "필터에 해당하는 도착 예정 버스가 없습니다." });
          } else {
            filtered
              .sort((a, b) => (Number(a.predictTime1) || 999) - (Number(b.predictTime1) || 999))
              .forEach((arrival) => this.renderArrival(list, arrival));
          }
          status.setText(`마지막 갱신 ${new Date().toLocaleTimeString("ko-KR")}`);
        } catch (error) {
          console.error("Bus Arrival", error);
          status.setText(`조회 실패: ${error.message || error}`);
        } finally {
          loading = false;
          refreshButton.disabled = false;
        }
      };

      refreshButton.addEventListener("click", render);
      await render();
      const scheduleAutoRefresh = () => {
        if (timer !== null) {
          window.clearInterval(timer);
          timer = null;
        }
        const globalSeconds = Number(this.settings.autoRefreshSeconds);
        const seconds = globalSeconds === -1
          ? Math.max(config.refreshSeconds, 30)
          : globalSeconds;
        if (!disposed && seconds > 0) {
          timer = window.setInterval(render, seconds * 1000);
        }
      };
      const schedulerSet = this.autoRefreshSchedulers;
      schedulerSet.add(scheduleAutoRefresh);
      scheduleAutoRefresh();
      ctx.addChild({
        load() {},
        unload() {
          disposed = true;
          if (timer !== null) window.clearInterval(timer);
          schedulerSet.delete(scheduleAutoRefresh);
        },
      });
    });
  }

  rescheduleAutoRefresh() {
    for (const schedule of this.autoRefreshSchedulers) schedule();
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  makeUrl(path, params) {
    let serviceKey = this.settings.serviceKey.trim();
    try {
      // Encoding 키를 붙여 넣어도 URLSearchParams가 이중 인코딩하지 않도록
      // 먼저 Decoding 형태로 정규화한다.
      if (serviceKey.includes("%")) serviceKey = decodeURIComponent(serviceKey);
    } catch (error) {
      console.warn("Bus Arrival: 인증키 디코딩 실패, 입력값을 그대로 사용합니다.", error);
    }
    const query = new URLSearchParams({
      serviceKey,
      format: "json",
      ...params,
    });
    return `https://apis.data.go.kr/6410000/${path}?${query.toString()}`;
  }

  async fetchArrivals(stopId) {
    const key = String(stopId);
    const now = Date.now();
    const cached = this.arrivalCache.get(key);
    if (cached && cached.expiresAt > now) return cached.promise;

    const promise = this.fetchArrivalsFromApi(stopId);
    this.arrivalCache.set(key, { promise, expiresAt: now + 10000 });
    promise.catch(() => this.arrivalCache.delete(key));
    return promise;
  }

  async fetchArrivalsFromApi(stopId) {
    let response;
    try {
      response = await requestUrl({
        url: this.makeUrl("busarrivalservice/v2/getBusArrivalListv2", { stationId: stopId }),
      });
    } catch (error) {
      if (error && (error.status === 401 || String(error.message || error).includes("401"))) {
        throw new Error("인증키가 아직 활성화되지 않았거나 유효하지 않습니다. 발급 직후라면 잠시 후 다시 시도하고, 설정의 인증키를 확인하세요.");
      }
      throw error;
    }
    const json = response.json;
    const apiError = getApiError(json);
    if (apiError) throw new Error(apiError);
    const body = getMessageBody(json);
    return asArray(body && body.busArrivalList);
  }

  async resolveStationId(stopId, stopName) {
    const raw = String(stopId || "").trim();
    const mobileNo = raw.replace(/[^0-9]/g, "");
    if (!/^\d{5}$/.test(mobileNo)) return raw;

    let response;
    try {
      response = await requestUrl({
        url: this.makeUrl("busstationservice/v2/getBusStationListv2", { keyword: mobileNo }),
      });
    } catch (error) {
      if (error && (error.status === 403 || String(error.message || error).includes("403"))) {
        throw new Error("표기 정류소 ID를 변환하려면 경기도 정류소 조회 API 권한이 필요합니다.");
      }
      throw error;
    }

    const json = response.json;
    const apiError = getApiError(json);
    if (apiError) throw new Error(`정류소 조회 API: ${apiError}`);
    const body = getMessageBody(json);
    const stations = asArray(body && body.busStationList);
    const exact = stations.find((station) =>
      String(station.mobileNo || "").replace(/[^0-9]/g, "") === mobileNo
    );
    const station = exact || stations.find((item) =>
      stopName && String(item.stationName || "").includes(String(stopName).split("→")[0].trim())
    );
    if (!station || !station.stationId) {
      throw new Error(`정류소 ${raw}의 실제 ID를 찾지 못했습니다.`);
    }
    return String(station.stationId);
  }

  async fetchRouteName(routeId) {
    const key = String(routeId || "");
    if (!key) return "알 수 없음";
    if (this.routeNameCache.has(key)) return this.routeNameCache.get(key);

    let response;
    try {
      response = await requestUrl({
        url: this.makeUrl("busrouteservice/v2/getBusRouteInfoItemv2", { routeId: key }),
      });
    } catch (error) {
      if (error && (error.status === 403 || String(error.message || error).includes("403"))) {
        throw new Error("버스 도착정보 인증은 성공했지만, 경기도 버스노선 조회 API 권한이 없습니다. 공공데이터포털에서 해당 API를 활용신청하세요.");
      }
      throw error;
    }
    const json = response.json;
    const apiError = getApiError(json);
    if (apiError) throw new Error(`노선 조회 API: ${apiError}`);
    const body = getMessageBody(json);
    const item = body && body.busRouteInfoItem;
    const routeName = item && item.routeName ? String(item.routeName) : key;
    this.routeNameCache.set(key, routeName);
    return routeName;
  }

  renderArrival(parent, arrival) {
    const row = parent.createDiv({ cls: "bus-arrival__row" });
    row.createDiv({ cls: "bus-arrival__route", text: arrival.routeName });
    const times = row.createDiv({ cls: "bus-arrival__times" });
    const first = arrival.predictTime1
      ? `${arrival.predictTime1}분 (${arrival.locationNo1 || "?"}정거장)`
      : "도착정보 없음";
    times.createDiv({ cls: "bus-arrival__first", text: first });
    if (arrival.predictTime2) {
      times.createDiv({ cls: "bus-arrival__second", text: `다음 ${arrival.predictTime2}분 (${arrival.locationNo2 || "?"}정거장)` });
    }
  }
};
