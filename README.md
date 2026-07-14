# Obsidian Bus Arrival

경기도 버스 정류소의 실시간 도착정보를 Obsidian 문서 안에 표시하는 플러그인입니다.

## 기능

- `bus-arrival` 코드 블록을 실시간 버스 도착정보 카드로 렌더링
- 문서에 지정한 노선만 필터링
- 첫 번째·두 번째 도착 예정 시간과 남은 정류장 표시
- 수동 새로고침 및 전역 자동 갱신 주기 설정
- 표기 정류소 번호(예: `07-045`)를 경기 정류소 ID로 자동 변환
- 데스크톱과 모바일 Obsidian 지원

## 설치

저장소의 다음 파일을 Vault의 `.obsidian/plugins/bus-arrival/`에 복사합니다.

- `main.js`
- `manifest.json`
- `styles.css`

Obsidian을 다시 시작한 뒤 `설정 → 커뮤니티 플러그인`에서 **Bus Arrival**을 활성화합니다.

## 공공데이터 API 준비

공공데이터포털에서 다음 API 세 개를 활용신청합니다.

1. [경기도 버스도착정보 조회](https://www.data.go.kr/data/15080346/openapi.do)
2. [경기도 버스노선 조회](https://www.data.go.kr/data/15080662/openapi.do)
3. [경기도 정류소 조회](https://www.data.go.kr/data/15080666/openapi.do)

승인 후 `설정 → Bus Arrival`에 일반 인증키의 **Decoding 키**를 입력합니다. 인증키는 플러그인의 로컬 `data.json`에 저장되며 Git 저장소에는 포함하지 않습니다.

## 문서 문법

~~~markdown
```bus-arrival
stopId: 실제정류소ID 또는 표기정류소번호
stopName: 정류소 표시 이름
routes:
  - 11
  - 15
  - 5
  - 700-2
refreshSeconds: 60
```
~~~

`refreshSeconds`는 플러그인 설정에서 **문서의 refreshSeconds 사용**을 선택했을 때만 적용됩니다. API 호출량 보호를 위해 자동 갱신은 기본적으로 꺼져 있습니다.

## 공유용 HTML 템플릿

`web/index.template.html`은 Obsidian이 없는 사용자에게 제공할 수 있는 단일 HTML 템플릿입니다. 기본 인증키는 비어 있으며 사용자가 입력한 값은 브라우저의 `localStorage`에 저장됩니다.

개인 인증키가 포함된 배포용 `web/index.html`은 `.gitignore`로 제외됩니다.

## 보안

- `data.json`을 커밋하지 않습니다.
- 인증키가 삽입된 `web/index.html`을 커밋하지 않습니다.
- 공개 배포 시 API 키를 HTML에 직접 포함하지 말고 서버 측 프록시 사용을 권장합니다.
