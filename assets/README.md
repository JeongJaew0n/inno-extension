# assets

**배포본에 들어가지 않는 원본·보관본.**

`public/` 에 두면 Vite 가 통째로 `dist/` 로 복사해 ZIP 에 실린다. 실제로 그렇게 됐다가
배포본이 175KB → 2.5MB 로 불어난 것을 확인하고 여기로 옮겼다.

| 경로 | 내용 |
| --- | --- |
| `icons/source-icon.png` | 확장 아이콘 원본(1254×1254). 크기를 다시 뽑을 때 쓴다 |
| `icons/legacy/` | 2026-09-18 이전 아이콘. 참고용으로 남긴다 |

## 아이콘 다시 뽑기

```bash
for size in 16 32 48 128; do
  sips -s format png -z $size $size assets/icons/source-icon.png \
    --out "public/icons/icon-$size.png"
done
```

`public/icons/` 에 있는 것만 배포본에 실린다.
