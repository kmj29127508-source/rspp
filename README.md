# 생산순서 최적화 방법 비교 (발표용 웹페이지)

`results.csv`를 읽어서 방법별 순위, 막대그래프, 날짜별 추이를 보여주는 페이지예요.
서버가 필요 없어서 GitHub Pages에 그대로 올릴 수 있어요.

## 화면에서 바꿀 수 있는 것

| 입력 | 하는 일 |
|---|---|
| 파일 끌어놓기 | 내 `results.csv`로 바로 교체 (엑셀에서 저장한 CSV도 읽어요) |
| 시나리오 | 파이썬에서 미리 돌려둔 파라미터 조합 (피커 1명 / 2명 등) |
| 선반 한도 | 한도를 넘는 날 수와 그래프의 빨간 선이 바뀜 |
| 판정 기준 1·2·3순위 | 순위표가 바뀜 (결과 보기 전에 정해두세요) |
| 방법 선택 | 표와 그래프에 나올 방법 (`대표 6개`, `전체`, `무작위 빼고`) |
| 날짜 선택 | 전체 / 월요일만 / 평일만 / 직접 선택 |
| 발표 모드 | 설정 패널을 숨기고 글자를 키움 (Esc로 돌아옴) |

## 한계 (꼭 알아두세요)

브라우저 안에서는 파이썬 시뮬레이션을 다시 돌릴 수 없어요.
그래서 **"피커 3명" 같은 새 파라미터는 화면에서 숫자를 넣는다고 계산되지 않고**,
파이썬에서 시나리오에 추가해서 `results.csv`를 다시 만들어 올려야 해요. (아래 2번)
선반 한도, 판정 기준, 방법·날짜 선택은 CSV 값으로 화면에서 바로 계산돼요.

## 1. GitHub에 올리기 (터미널 없이, 브라우저만)

1. github.com 로그인 → 오른쪽 위 `+` → **New repository**
2. 이름 입력(예: `production-compare`), **Public** 선택 → **Create repository**
3. 빈 저장소 화면에서 **uploading an existing file** 클릭
4. 이 폴더의 `index.html`, `app.js`, `style.css`, `README.md`, `data` 폴더를 통째로 끌어놓기 → **Commit changes**
   - 폴더가 안 올라가면 `data` 안의 파일을 하나씩 올려도 돼요. 새 파일 이름 칸에 `data/results.csv`처럼 슬래시를 넣으면 폴더가 만들어져요.
5. 저장소 **Settings → Pages → Source: Deploy from a branch → Branch: `main` / `(root)` → Save**
6. 1~2분 뒤 `https://내아이디.github.io/저장소이름/` 에서 열려요.

## 2. 내 결과로 교체하기

노트북에서:

```python
import os, sys
os.chdir(r"C:\Users\kmj29\Desktop\한달생산스케쥴평가코드"); sys.path.append(os.getcwd())
import production_sim as P, greedy_experiment as G, compare_all as C, export_for_web as W

sku, lines = P.load_data()
W.export(P, sku, lines, C)        # 전체 27일 × 시나리오 (시간이 걸려요) → results.csv 생성
```

만들어진 `results.csv`를 저장소의 `data/` 폴더에 올리면 (같은 이름이면 덮어쓰기) 샘플 배너가 사라지고 내 결과가 나와요.
올리기 전에 이 페이지에 끌어놓아서 먼저 확인해볼 수도 있어요.

시나리오를 늘리려면 `export_for_web.py`의 `SCENARIOS`에 한 줄 추가하세요.

```python
"피커 3명 · DD→PD (strict)": dict(N_PICKERS=3, PICK_RULE="strict", TYPE_ORDER=["DD", "PD"]),
```

## 3. 파일 구성

```
index.html            화면
style.css             모양
app.js                계산·그래프 (외부 라이브러리 없음, 오프라인에서도 동작)
data/sample_results.csv   샘플 (임시 크기표로 만든 값, 실제 결과 아님)
data/sample_results.js    위 샘플을 페이지에 내장한 것 (results.csv가 없을 때만 사용)
data/results.csv          ← 내 결과를 여기에 (없으면 샘플이 보여요)
```

## 주의

- GitHub Pages 주소는 **누구나 볼 수 있어요.** `results.csv`에는 날짜별 요약 숫자만 있고 주문번호·SKU는 없지만,
  `simple_data.xlsx` 같은 원본 데이터는 **절대 저장소에 올리지 마세요.** 팀에 공개해도 되는지 확인하세요.
- 로컬에서 `index.html`을 더블클릭해 열면 `data/results.csv`를 자동으로 못 읽어요(브라우저 보안).
  그때는 샘플이 뜨니까 위 상자에 `results.csv`를 끌어놓으세요.
