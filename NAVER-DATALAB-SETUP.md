# 네이버 데이터랩 통합검색 연동 (운영자용)

이 서비스는 aT 공식 중도매 가격과 **네이버 데이터랩 통합검색 상대지수**를 비교합니다. 실제 판매량이나 절대 검색량이 아닙니다.

## 운영 환경 연결

1. [NAVER Developers](https://developers.naver.com/) 로그인 → Application → 애플리케이션 등록.
2. 사용할 API로 **데이터랩(검색어트렌드)** 선택. Client ID와 Client Secret 확인.
3. Vercel `fruit-price-lab` → Settings → Environment Variables → **Production** 대상에 아래 2개를 각각 **Secret**으로 저장:
   - `NAVER_CLIENT_ID`
   - `NAVER_CLIENT_SECRET`
4. Vercel 프로덕션을 다시 배포해서 설정을 적용. 브라우저의 **이번 달 TOP 10** 탭에서 공식 검색 상대지수 표시를 확인.

키를 GitHub, 프런트엔드 코드, 브라우저, 이슈, 채팅에 적지 마세요. 이 프로젝트는 자격증명 없이도 중도매 가격·제철 정보만 표시하도록 구현되어 있습니다.

## 분석 알고리즘

- `GET /api/search-trends`: 서버에서 네이버 공식 `POST /v1/datalab/search` 호출.
- 20개 과일용 고정 검색어 그룹, 요청당 최대 5개 그룹. 서버 측 6시간 캐시로 API 사용량 제한.
- 한국시간 오늘의 미완성 데이터는 제외하고, **최근 완료 7일 vs 바로 이전 7일** 일간 상대지수 평균을 비교.
- 두 구간 각각 5일 이상 유효한 자료와 직전 평균 1 이상의 수치가 있어야 변동률을 표시.
- 네이버의 상대지수는 **그룹 또는 요청 묶음 간 절대적 인기 비교에 사용할 수 없으므로**, 각 과일 검색어 그룹의 시간상 증감만 사용.
- API 자격증명이 없거나 외부 서비스가 실패한 경우 관심도 0% 같은 가짜 수치를 표시하지 않음.
- 검색 관심 상승(15% 이상)과 **동일 품종** 중도매 가격 하락(5% 이상)이 모두 실제 자료로 확인될 때에만 **검색↑·가격↓** 신호 부여.
- 가격은 품종 단위, 검색 관심도는 관련 과일 검색어 그룹 단위이므로 '품종별 소비자 수요'를 직접 측정하는 것은 아님.

공식 문서: https://developers.naver.com/docs/serviceapi/datalab/search/search.md

검증: `node scripts/check-search-trends.cjs` (외부 API를 모킹), `node scripts/check-ui.cjs` (jsdom 필요).
