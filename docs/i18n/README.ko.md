# Sync Trakt

[![Latest release](https://img.shields.io/github/v/release/o1xhack/obsidian-sync-trakt?include_prereleases&label=release&color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![Total downloads](https://img.shields.io/github/downloads/o1xhack/obsidian-sync-trakt/total?color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![License](https://img.shields.io/github/license/o1xhack/obsidian-sync-trakt?color=7c3aed)](../../LICENSE)
[![Min Obsidian version](https://img.shields.io/badge/obsidian-1.8.7%2B-7c3aed)](https://obsidian.md)

**[Trakt.tv](https://trakt.tv) 시청 기록을 풍부하게 현지화된 마크다운 라이브러리로 변환합니다 — 에피소드별 타임스탬프, 15개 이상 언어를 지원하는 메타데이터, 그리고 vault를 흔들지 않는 조용한 증분 동기화.**

> 🌐 [English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · **한국어** · [Français](README.fr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Italiano](README.it.md)

<!-- screenshot: hero -->

## ✨ 왜 사용하나요?

- **상세한 시청 기록** — 어떤 에피소드를 언제 시청했는지(다시 본 것 포함) 정확히 기록되며, 새 에피소드를 볼 때마다 동기화됩니다
- **15개 이상 언어를 지원하는 메타데이터** — TMDB를 통해 제목 / 줄거리 / 태그라인 / 장르를 번역합니다. 중국어(간체/번체/홍콩), 일본어, 한국어, 프랑스어, 독일어, 스페인어(스페인/멕시코), 포르투갈어(브라질), 이탈리아어, 러시아어 프리셋과, TMDB가 지원하는 모든 locale을 지정할 수 있는 사용자 정의 모드를 제공합니다. 영어 원문은 항상 `*_original_*` frontmatter 필드에 보존됩니다
- **11개 노트 템플릿 언어** _(0.6.0)_ — 수작업으로 번역된 노트 템플릿이 en + zh-CN + zh-TW + ja + ko + fr + de + it + es + pt-BR + ru를 커버. 새로운 템플릿 언어 드롭다운에서 선택, 언제든지 전환 가능(사용자 정의 내용은 유지)
- **탭 형식 설정 UI** _(0.6.0)_ — 일반 / 노트 / 동기화 / Daily Notes 4개 탭. 마지막으로 본 탭은 기기별로 기억
- **Daily Notes 연동** _(0.7.0)_ — 동기화할 때마다 각 이벤트(시청 / 시청 목록 추가 / 즐겨찾기 / 평가)를 시간순으로 Daily Note에 자동 삽입. 템플릿 언어를 따름. 마커 구간 내 내용은 플러그인이 관리하며 **구간 외 내용은 절대 수정되지 않음**. [spec 0006](../specs/0006-daily-notes-integration.md) 참조
- **증분 동기화** _(0.2.0)_ — 첫 동기화로 로컬 TMDB 캐시와 Trakt 기록 상태를 채우고, 이후 동기화는 변경된 부분만 가져옵니다. 정상 상태 동기화 시간이 몇 분에서 몇 초로 단축됩니다. [spec 0001](../specs/0001-incremental-sync.md) 참조
- **조용한 쓰기** _(0.3.0)_ — 동기화는 **실제로 내용이 변경된** 노트만 다시 씁니다. 새 에피소드 한 편을 시청한 후, 1200개 항목의 라이브러리는 1200개가 아닌 1개의 노트만 다시 쓰여 — Obsidian Sync / iCloud / Syncthing 등 기기 간 동기화 계층이 라이브러리 전체를 매번 다시 업로드하지 않게 됩니다. [spec 0002](../specs/0002-diff-based-write.md) 참조
- **설정별 클라우드 토글** _(0.5.0)_ — 각 설정 항목별로 기기 간 동기화 여부를 개별 선택. 예: "Mac에서는 30분마다 자동 동기화, iPhone에서는 완전히 끄기"와 같은 구성 가능. [spec 0003](../specs/0003-device-local-settings.md) 참조

## 🎬 상세한 시청 기록

**시청 기록 동기화(상세)** 를 활성화하면 플러그인이 Trakt의 `/sync/history` 엔드포인트를 호출하여 에피소드별(또는 영화별) 타임스탬프를 노트 본문에 직접 렌더링하고, 새 에피소드를 시청할 때마다 자동으로 업데이트합니다:

```markdown
## Watch History
- S1E1 — 2024-01-15 21:30, 2024-03-22 19:00
- S1E2 — 2024-01-16 22:00
- S1E3 — 2024-01-17 21:45
- S2E1 — 2024-04-02 20:00
```

다시 본 에피소드는 쉼표로 구분되며, 시즌 → 에피소드 번호 순서로 정렬됩니다. 이 블록은 `%% trakt:watch-history %%` 마커로 감싸져 있어 플러그인은 마커 사이의 내용만 업데이트합니다. **노트 본문의 다른 부분에 직접 작성한 내용은 절대 건드리지 않습니다.**

<!-- screenshot: watch-history -->

## 🌐 메타데이터 현지화

**메타데이터 언어** 를 원하는 언어로 설정하면 동기화된 노트의 제목 / 줄거리 / 태그라인 / 장르가 TMDB를 통해 번역됩니다(TMDB 키가 없을 때는 Trakt 번역 엔드포인트로 폴백). 영어 원문은 `trakt_original_*` 필드에 유지됩니다:

```yaml
trakt_title: 다크 나이트
trakt_original_title: The Dark Knight
trakt_genres:
  - 액션
  - 범죄
  - 드라마
trakt_original_genres:
  - Action
  - Crime
  - Drama
trakt_metadata_language: ko-KR
```

태그와 tag-note 경로는 **항상 영어로 유지** — 기존 Dataview 쿼리는 언어를 전환해도 계속 작동합니다.

<!-- screenshot: metadata-localization -->

## 🌍 플러그인 UI 와 노트 템플릿

메타데이터 현지화가 한 축이고, 플러그인 자체의 표면들은 별도의 축입니다:

- **설정 탭, 명령 팔레트, 알림 팝업** 은 현재 **English** 와 **简体中文** 지원. 다른 UI 언어는 요청에 따라 — 기여하고 싶다면 [issue를 열어](https://github.com/o1xhack/obsidian-sync-trakt/issues) 주세요
- **번들된 노트 템플릿** _(0.6.0에서 3개 → 11개 언어로 확장)_ — 영어, 간체 중국어(zh-CN), 번체 중국어(zh-TW / zh-HK), 일본어, 한국어, 프랑스어, 독일어, 이탈리아어, 스페인어, 포르투갈어(BR), 러시아어. 기계 번역이 아닌 수작업 번역; 섹션 제목, 항목 라벨, 구두점은 각 언어의 관습을 따름(일본어는 전각 콜론, 프랑스어는 공백 콜론 등). 템플릿 언어 드롭다운은 이 11개만 표시(이전에는 다른 언어가 조용히 영어로 폴백되어 혼란스러웠음)

<!-- screenshot: bilingual-ui -->

## 📅 Daily Notes 연동 _(0.7.0)_

동기화할 때마다 당일 이벤트를 시간순으로 Daily Note에 자동 삽입합니다. 시청한 에피소드, 시청 목록 추가, 즐겨찾기, 평가 모두 포함:

```markdown
%% trakt:daily:start %%
10:00 — 시청 低智商犯罪 (2026) S1E16, S1E17
14:30 — 시청 목록에 추가 黑暗骑士 (2008)
21:30 — 9/10점 평가 重生 (2020)
%% trakt:daily:end %%
```

각 이벤트 타입은 해당 「동기화 소스」 토글로 제어됩니다 — 예를 들어 「즐겨찾기 동기화」를 끄면 즐겨찾기 이벤트도 Daily Notes에 표시되지 않습니다. 동사(`시청` / `視聴` / `a regardé`…)는 **템플릿 언어** 설정을 따르며 11개 번들 언어 모두를 지원합니다.

**안전 계약**: 마커 구간 내 내용은 플러그인이 관리하며, **구간 외 내용은 절대 수정되지 않습니다**. 과거 날짜는 추가만(기존 마커 보존), 오늘 내용은 동기화할 때마다 갱신되어 밤늦게 시청한 새 콘텐츠도 올바르게 반영됩니다. 폴더와 파일명 형식(`YYYY-MM-DD` 또는 `YYYY/YYYY.MM.DD` 같은 Moment.js 구문)은 **설정 → Daily Notes** 에서 구성. 수동 **백필** 버튼은 최대 30일까지 지원. [spec 0006](../specs/0006-daily-notes-integration.md) 참조.

## 🔄 다중 기기 동기화

인증 상태(Trakt 토큰, TMDB 키, 모든 설정)는 vault의 `.obsidian/plugins/sync-trakt/data.json`에 저장되며 vault 동기화 레이어를 따릅니다. Mac에서 한 번 설정한 후 Obsidian Sync(`Plugin data` 활성화), Syncthing, iCloud + Advanced Data Protection, 또는 Cryptomator를 통해 iPhone과 공유할 수 있습니다. **플러그인은 어떤 서버에도 데이터를 저장하지 않습니다.**

0.5.0부터 **모든 개별 설정을 기기 간 동기화에서 제외 가능** — 설정 항목 옆의 작은 클라우드 아이콘으로 전환합니다(현재 「시작 시 동기화」, 「자동 동기화」, 「자동 동기화 간격」, 「플러그인 UI 언어」 4개 항목에 노출). 「Mac에서는 30분마다 자동 동기화, iPhone에서는 끄기」 같은 구성에 유용합니다.

## 📊 Obsidian Bases에서 라이브러리 보기

`trakt_poster_url` frontmatter 필드는 [Obsidian Bases](https://help.obsidian.md/bases)(Obsidian 1.9.3+)와 **즉시 호환**됩니다 — 동기화 폴더 위에 데이터베이스 뷰를 만들면 포스터가 썸네일로 표시됩니다:

- **카드 뷰**: Display 설정 열기 → **Image property**를 `trakt_poster_url`로 설정
- **테이블 뷰**(1.9.4+): `image(note.trakt_poster_url)` formula 컬럼 추가

`trakt_type = "movie"` / `"show"`로 필터링, `trakt_year` / `trakt_rating` / `trakt_my_rating`으로 정렬, `trakt_genres`로 그룹화 모두 가능합니다. Dataview 쿼리에 사용하는 frontmatter 속성은 Bases 뷰에서도 그대로 작동합니다 — 추가 설정 불필요.

## 🚀 빠른 시작

1. [BRAT](https://github.com/TfTHacker/obsidian42-brat) 으로 설치 → **Add a beta plugin for testing** → `o1xhack/obsidian-sync-trakt`
2. 설정 → **Sync Trakt** → Trakt + TMDB API 키 입력([설정 가이드](../SETUP.md))
3. 명령 팔레트 → **Traktr: Sync**

## 🔑 API 키가 각각 잠금 해제하는 기능

플러그인은 두 개의 API를 사용합니다. **Trakt는 필수** — 없으면 아무것도 동기화할 수 없습니다. **TMDB는 선택사항**이지만, 대부분의 사용자가 이 플러그인을 설치하는 진짜 이유(다국어 메타데이터·포스터)는 이쪽에서 잠금 해제됩니다:

| 기능 | Trakt API<br/>_(필수)_ | TMDB API<br/>_(권장)_ |
|---|:---:|:---:|
| Trakt 라이브러리 동기화(watchlist, watched, favorites, ratings) | ✅ | — |
| 에피소드별 시청 타임스탬프 | ✅ | — |
| title / overview / tagline 을 자국어로 번역 | ✅ 기본 | ✅ 더 높은 품질 |
| **genres를 자국어로 번역** | ❌ | ✅ |
| **노트에 포스터 이미지 임베드** | ❌ | ✅ |

영어 콘텐츠로 만족하고 포스터가 필요 없다면 TMDB는 비워둬도 됩니다 — Trakt만으로 충분합니다. 비영어 완전 현지화(genres와 포스터 포함)를 원한다면 **TMDB 키를 입력**하세요([무료 가입](https://www.themoviedb.org/settings/api)). 키를 붙여 넣은 후, 입력란 옆의 **Test** 버튼으로 작동 여부를 확인한 다음 첫 동기화를 진행하세요.

→ [두 키의 전체 설정 가이드](../SETUP.md)

## 📦 설치

<details>
<summary><b>BRAT (권장)</b></summary>

[BRAT](https://github.com/TfTHacker/obsidian42-brat)은 임의의 GitHub 저장소에서 플러그인을 설치하고 자동 업데이트합니다.

1. 커뮤니티 플러그인에서 **Obsidian42 - BRAT** 설치 및 활성화
2. 설정 → BRAT → **Add a beta plugin for testing**
3. 다음을 붙여넣기:
   ```
   o1xhack/obsidian-sync-trakt
   ```
4. **Add Plugin** 클릭 → 설정 → 커뮤니티 플러그인에서 활성화

이후 Obsidian이 시작될 때마다 BRAT이 업데이트를 확인하고 새 릴리스를 자동으로 가져옵니다.

</details>

<details>
<summary><b>수동 설치</b></summary>

1. [최신 릴리스](https://github.com/o1xhack/obsidian-sync-trakt/releases/latest)에서 `main.js`, `manifest.json`, `styles.css` 다운로드
2. 세 파일을 `<your-vault>/.obsidian/plugins/obsidian-sync-trakt/`에 배치
3. 설정 → 커뮤니티 플러그인 → **Sync Trakt** 활성화

</details>

<details>
<summary><b>Obsidian 커뮤니티 플러그인 (제출 예정)</b></summary>

> ⚠️ Obsidian 공식 커뮤니티 플러그인 디렉토리에 아직 등록되지 않았습니다. 승인되면 이것이 권장 경로가 됩니다. 그때까지는 위의 BRAT을 사용하세요.

</details>

<details>
<summary><b>소스에서 빌드</b></summary>

```bash
git clone https://github.com/o1xhack/obsidian-sync-trakt.git
cd obsidian-sync-trakt
npm install
npm run build      # main.js 생성
npm run lint
npm run test:i18n  # 스모크 테스트
```

그런 다음 `main.js`, `manifest.json`, `styles.css`를 `<vault>/.obsidian/plugins/obsidian-sync-trakt/`에 복사합니다.

</details>

## 📚 문서

| 문서 | 내용 |
|---|---|
| [SETUP](../SETUP.md) | Trakt + TMDB API 키 생성, 초기 설정, 문제 해결 (영어) |
| [MANUAL](../MANUAL.md) | 설정 전체 참조, frontmatter 필드, 템플릿 변수, 동기화 동작 (영어) |
| [DEVELOPER](../DEVELOPER.md) | 아키텍처 개요, 데이터 흐름, 확장 방법 (영어 전용) |
| [docs/i18n/](.) | README의 8개 언어 번역 |

## 🗺️ 로드맵

포크 이후 주요 버전(시간순):

- [x] **0.1** — 초기 포크. 에피소드별 상세 시청 기록, TMDB + Trakt 폴백 체인을 통한 메타데이터 현지화, 이중 언어 UI(en + zh-CN), 번역된 노트 템플릿(en + zh-CN + zh-TW), 상위 traktr와 공존 가능한 별도의 plugin id
- [x] **0.2** — 증분 동기화. 영구 TMDB 캐시(stale-while-revalidate, 90일 TTL + 지터) + Trakt 기록 상태 커서. 정상 상태 동기화가 몇 분에서 몇 초로 단축. → [spec 0001](../specs/0001-incremental-sync.md)
- [x] **0.3** — Diff 기반 쓰기. frontmatter나 관리 본문 섹션이 실제로 변경된 노트만 다시 쓰기, 기기 간 동기화 계층이 매번 1200개 파일을 흔드는 것을 방지. 0.3.x에는 추가로: TMDB API 키 테스트 버튼 + 메타데이터 언어가 설정됐지만 키가 없을 때의 경고 배너, 현지화된 제목 충돌에 대한 2단계 파일명 disambiguation("重生"이라는 같은 이름의 5개 시리즈가 같은 파일명을 두고 경쟁하는 문제). → [spec 0002](../specs/0002-diff-based-write.md)
- [x] **0.4** — 디렉토리 제출 준비. Plugin id를 `obsidian-sync-trakt` → `sync-trakt`로 이름 변경(Obsidian 공식 디렉토리 봇은 `obsidian`을 포함하는 id를 거부), `minAppVersion`을 1.6.6으로 강화, 첫 시작 시 레거시 폴더에서 자동 데이터 마이그레이션. → [spec 0004](../specs/0004-obsidian-directory-submission.md)
- [x] **0.5** — 기기 본지 설정 + 자동 정리. 각 설정 항목 옆의 클라우드 아이콘으로 기기 간 동기화 여부 개별 제어; 마이그레이션 후 레거시 폴더의 바이너리 파일 자동 정리(data.json은 안전망으로 유지), 사용자가 중복된 플러그인 항목 2개를 보지 않게 됨. → [spec 0003](../specs/0003-device-local-settings.md)
- [x] **0.6** — 탭 형식 설정 UI + 11개 노트 템플릿 언어. 설정 페이지를 4개 탭(일반 / 노트 / 동기화 / Daily Notes)으로 재구성; 노트 템플릿을 3개 언어에서 11개 언어로 확장(추가: ja, ko, fr, de, it, es, pt-BR, ru, 모두 수작업 번역); 템플릿 언어 드롭다운은 번들된 언어만 표시. → [spec 0005](../specs/0005-settings-ui-tabs.md) + [spec 0007](../specs/0007-template-language-expansion.md)
- [x] **0.7** — Daily Notes 연동. 동기화할 때마다 이벤트(시청 / 시청 목록 추가 / 즐겨찾기 / 평가)를 시간순으로 Daily Note에 자동 삽입, 템플릿 언어를 따름. 과거 날짜는 추가만, 오늘 내용은 수시 갱신. 수동 백필 버튼은 과거 30일까지 지원. → [spec 0006](../specs/0006-daily-notes-integration.md)
- [ ] **진행 중** — Obsidian 공식 [Community Plugins 디렉토리](https://obsidian.md/plugins) 제출. [PR #12757](https://github.com/obsidianmd/obsidian-releases/pull/12757) 검토 중
- [ ] **향후** — UI 번역 추가(현재 en + zh-CN)는 요청에 따라; 번들 템플릿 언어 추가도 사용자 요청에 따라

## 🤝 감사의 말

이 플러그인은 원래 [sarimabbas/traktr](https://github.com/sarimabbas/traktr)(MIT 라이선스)에서 영감을 받아 Trakt OAuth 연결의 초기 스캐폴딩을 가져왔습니다. 이후 상당한 작업 — 상세한 시청 기록 집계, 번역 폴백 체인이 있는 메타데이터 현지화, 이중 언어 UI, 실시간 진행률 보고가 있는 동시성 제한 페칭, 머신 관리 본문 섹션, 번역 인식 템플릿 렌더러, 다국어 문서 체계 — 을 통해 코드베이스의 대부분이 근본적으로 다른 아키텍처로 재구성되었습니다.

시작점을 제공해 준 [Sarim Abbas](https://github.com/sarimabbas)에게 감사드립니다. 원작의 MIT 저작권 고지는 이 프로젝트 자체의 고지와 함께 [LICENSE](../../LICENSE)에 그대로 보존됩니다.

## 📄 라이선스

MIT — [LICENSE](../../LICENSE) 참조.

---

작성자: [o1xhack](https://github.com/o1xhack)
