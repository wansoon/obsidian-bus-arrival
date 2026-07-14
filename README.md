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

### 데스크톱 수동 설치

저장소의 다음 파일을 Vault의 `.obsidian/plugins/bus-arrival/`에 복사합니다.

- `main.js`
- `manifest.json`
- `styles.css`

Obsidian을 다시 시작한 뒤 `설정 → 커뮤니티 플러그인`에서 **Bus Arrival**을 활성화합니다.

## iPhone·iPad에서 사용

### 방법 1: 같은 Vault 설정 동기화

데스크톱과 iPhone·iPad에서 이미 같은 Vault를 동기화하고 있다면 이 방법이 가장 간단합니다.

1. 동기화 대상에 `.obsidian/plugins/bus-arrival/` 폴더가 포함됐는지 확인합니다.
2. 모바일 Obsidian을 완전히 종료했다가 다시 실행합니다.
3. `설정 → 커뮤니티 플러그인`에서 커뮤니티 플러그인 사용을 허용합니다.
4. 설치된 플러그인 목록에서 **Bus Arrival**을 활성화합니다.
5. `설정 → Bus Arrival`에서 인증키와 자동 갱신 주기를 확인합니다.

플러그인이 목록에 없으면 `.obsidian` 설정 폴더가 모바일로 동기화되지 않은 상태입니다. 플러그인의 `data.json`을 동기화하지 않았다면 모바일에서 인증키를 한 번 입력해야 합니다.

API 호출은 기기별로 합산됩니다. 여러 기기에서 같은 문서를 동시에 열 수 있으므로 모바일에서는 평소 **자동 갱신 끄기**를 권장합니다.

### 방법 2: BRAT으로 GitHub에서 설치

1. 모바일 Obsidian의 `설정 → 커뮤니티 플러그인 → 탐색`에서 **BRAT**을 설치하고 활성화합니다.
2. 아이폰 노트 화면을 위에서 아래로 당겨 명령 팔레트를 엽니다. 열리지 않으면 `≡ 메뉴 → 명령 팔레트(>_)`를 누릅니다.
3. 명령 팔레트에서 `BRAT: Plugins: Add a beta plugin for testing`을 실행합니다.
4. 저장소 경로 `wansoon/obsidian-bus-arrival`을 입력하고 **Add Plugin**을 누릅니다.
5. 설치가 끝나면 `설정 → 커뮤니티 플러그인`에서 **Bus Arrival**을 활성화합니다.
6. `설정 → Bus Arrival`에 공공데이터포털 인증키를 입력합니다.

- [BRAT 설치 안내](https://tfthacker.com/brat-quick-guide)
- 이 저장소는 Public이므로 GitHub 로그인이나 Private repository token이 필요하지 않습니다.

### 모바일에서 보이지 않을 때

- Obsidian과 BRAT을 최신 버전으로 업데이트합니다.
- 커뮤니티 플러그인 목록을 새로고침합니다.
- BRAT 명령 `Check for updates to all beta plugins and UPDATE`를 실행합니다.
- 그래도 보이지 않으면 Obsidian을 완전히 종료한 뒤 다시 실행합니다.

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

## License

이 프로젝트는 [MIT License](LICENSE)로 배포됩니다.

Copyright (c) 2026 alecsiel
