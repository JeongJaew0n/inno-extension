#!/usr/bin/env python3
"""
Material 3 전략으로 색조 팔레트를 만든다. 원천은 Figma 조합 59 「요트 클럽」 네 색이다.

빌드와 무관하다. 토큰을 다시 뽑을 때만 손으로 돌린다.

    python3 design/generate-tokens.py > design/tokens.css

## 무엇을 따랐나

M3 는 시드 한 색에서 **색조 팔레트**를 뽑고, 그 팔레트의 특정 색조를 **역할**에 배정한다.
색을 손으로 고르지 않는다 — 시드와 배정 규칙만 정하면 나머지는 계산이다.

M3 는 HCT(CAM16 기반)를 쓴다. 여기서는 **CIELCh** 로 같은 일을 한다. 색조(tone)를 L* 로 두고
색상·채도를 유지하되, sRGB 밖으로 나가면 채도를 이진 탐색으로 줄인다. HCT 의 gamut 해결과
같은 발상이고, 외부 라이브러리 없이 돌릴 수 있다.
"""

# ----------------------------------------------------------------------------
# 원천 색 — Figma 색상 조합 59 「요트 클럽」 (2026-09-28 채택)
#
# https://www.figma.com/ko-kr/resource-library/color-combinations/
# 값은 그 팔레트 이미지에 적힌 라벨을 그대로 옮겼다.
#
# M3 는 시드 한 색에서 전부를 뽑지만, 여기는 **조합 자체가 네 색을 정해 준다.** 그래서 각 팔레트를
# 대응하는 원천 색의 색상·채도에서 뽑는다.
#
#   surface  #F2F0EF  L* 94.9  hue 55.6  chroma 0.9   따뜻한 회백 → neutral 의 색상
#   outline  #BBBDBC  L* 76.4  hue 163.6 chroma 0.9   회색 테두리 → neutral-variant 자리(tone 80 부근)
#   primary  #245F73  L* 37.5  hue 234.3 chroma 20.9  짙은 청록   → primary
#   accent   #733E24  L* 32.3  hue 51.3  chroma 33.1  갈색        → tertiary
# ----------------------------------------------------------------------------
SOURCE = {
    'surface': '#F2F0EF',
    'outline': '#BBBDBC',
    'primary': '#245F73',
    'accent':  '#733E24',
}
SEED = SOURCE['primary']
# 85 는 강조 컨테이너용이다. 아래 PALETTES 주석 참고
TONES = [0, 4, 6, 10, 12, 17, 20, 22, 24, 30, 40, 50, 60, 70, 80, 85, 87, 90, 92, 94, 95, 96, 98, 100]


def srgb_to_linear(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def linear_to_srgb(c: float) -> float:
    return c * 12.92 if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055


D65 = (0.95047, 1.0, 1.08883)


def hex_to_lab(value: str):
    v = value.lstrip('#')
    r, g, b = (srgb_to_linear(int(v[i:i + 2], 16) / 255) for i in (0, 2, 4))
    x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / D65[0]
    y = (0.2126729 * r + 0.7151522 * g + 0.0721750 * b) / D65[1]
    z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / D65[2]
    f = lambda t: t ** (1 / 3) if t > 216 / 24389 else (24389 / 27 * t + 16) / 116
    fx, fy, fz = f(x), f(y), f(z)
    return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))


def lab_to_rgb(L: float, a: float, b: float):
    fy = (L + 16) / 116
    fx, fz = fy + a / 500, fy - b / 200
    g = lambda t: t ** 3 if t ** 3 > 216 / 24389 else (116 * t - 16) / (24389 / 27)
    x, y, z = g(fx) * D65[0], g(fy) * D65[1], g(fz) * D65[2]
    r = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z
    gg = -0.9692660 * x + 1.8760108 * y + 0.0415560 * z
    bb = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z
    return tuple(linear_to_srgb(c) for c in (r, gg, bb))


def in_gamut(rgb) -> bool:
    return all(-0.0005 <= c <= 1.0005 for c in rgb)


def tone_hex(hue: float, chroma: float, tone: float) -> str:
    """색조 `tone` 에서 `chroma` 를 최대한 지키되 sRGB 안으로 들어올 때까지 줄인다."""
    from math import cos, sin, radians
    lo, hi = 0.0, chroma
    best = (0.0, 0.0, 0.0)
    for _ in range(24):
        mid = (lo + hi) / 2
        rgb = lab_to_rgb(tone, mid * cos(radians(hue)), mid * sin(radians(hue)))
        if in_gamut(rgb):
            best, lo = rgb, mid
        else:
            hi = mid
    clamp = lambda c: max(0, min(255, round(c * 255)))
    return '#%02x%02x%02x' % tuple(clamp(c) for c in best)


def palette(hue: float, chroma: float) -> dict:
    return {t: tone_hex(hue, chroma, t) for t in TONES}


from math import atan2, degrees, hypot

def hue_chroma(value: str) -> tuple[float, float]:
    _, a, b = hex_to_lab(value)
    return degrees(atan2(b, a)) % 360, hypot(a, b)


SEED_HUE, SEED_CHROMA = hue_chroma(SOURCE['primary'])
ACCENT_HUE, ACCENT_CHROMA = hue_chroma(SOURCE['accent'])
SURFACE_HUE, _ = hue_chroma(SOURCE['surface'])
OUTLINE_HUE, _ = hue_chroma(SOURCE['outline'])

# 오류 색상각.
#
# **30° 에서 20° 로 옮겼다.** 강조 갈색이 51° 라 30° 면 21° 밖에 안 떨어진다. 진한 쪽은 괜찮지만
# (tone 40 끼리 ΔE 31.6) 연한 컨테이너가 복숭아색·분홍색으로 수렴해 ΔE 8.2 까지 붙었다. 보라 시드
# 때 `tertiary-90` 과 `error-90` 이 구분되지 않아 안내문이 오류처럼 보였던 것과 같은 문제다.
# 20° 는 여전히 빨강으로 읽힌다(tone 40 = #b22640).
ERROR_HUE = 20

PALETTES = {
    # 조합의 짙은 청록. 우리 정체성이다
    'primary': palette(SEED_HUE, SEED_CHROMA),
    # M3 는 보조색을 주색과 같은 색상에서 채도만 낮춰 뽑는다. 주색 채도가 20.9 로 원래 낮아서
    # M3 기본값(16)을 쓰면 주색과 거의 같아진다. 절반 아래로 내려 회청색으로 둔다
    'secondary': palette(SEED_HUE, 8),
    # 강조는 **조합이 정해 준 갈색**을 그대로 쓴다. 색상환을 돌려 만들 필요가 없다
    'tertiary': palette(ACCENT_HUE, ACCENT_CHROMA),
    # 중립은 조합의 회백·회색을 따른다. 둘 다 채도 0.9 로 사실상 무채색이라 M3 기본(4 / 8)보다
    # 한참 낮게 둔다.
    #
    # 표면(neutral)은 따뜻한 회백(55.6°), 테두리 쪽(neutral-variant)은 **차가운 회색(163.6°)** 에서
    # 뽑는다. 처음에 둘 다 회백 색상으로 뽑았더니 `outline-variant` 가 베이지(#cdc5c0)로 기울어
    # 원천 #BBBDBC 와 ΔE 5.6 이 났다. 조합이 일부러 따뜻한 바탕에 차가운 회색 선을 둔 것이다
    'neutral': palette(SURFACE_HUE, 2),
    'neutral-variant': palette(OUTLINE_HUE, 2),
    'error': palette(ERROR_HUE, 60),
}

# 원천 색을 **그대로** 앉히는 역할.
#
# 계산된 tone 40 은 원천과 조금 다르다 — 주색 #2b6579 (ΔE 2.4), 강조 #885035 (ΔE 7.7). 조합을
# 골랐으니 브랜드 색은 계산값이 아니라 원본이어야 한다. 둘 다 L* 가 tone 40 부근(37.5 / 32.3)이라
# 같은 자리에 앉혀도 `on-*`(tone 100, 흰색)과의 대비가 오히려 커진다.
ROLE_ANCHORS = {
    'primary': SOURCE['primary'],
    'tertiary': SOURCE['accent'],
}


# ----------------------------------------------------------------------------
# 역할 배정
#
# M3 의 핵심은 여기다. **색을 고르는 게 아니라 색조를 역할에 배정한다.**
# 밝은 배색의 배정 규칙을 그대로 쓴다.
# ----------------------------------------------------------------------------

ROLES = [
    ('primary',                 'primary', 40),
    ('on-primary',              'primary', 100),
    ('primary-container',       'primary', 90),
    ('on-primary-container',    'primary', 10),

    ('secondary',               'secondary', 40),
    ('on-secondary',            'secondary', 100),
    ('secondary-container',     'secondary', 90),
    ('on-secondary-container',  'secondary', 10),

    ('tertiary',                'tertiary', 40),
    ('on-tertiary',             'tertiary', 100),
    # **tone 85 다.** 90 이면 오류 컨테이너와 ΔE 8.2 로 붙는다. 85 에서 16.1 로 벌어진다.
    # 위 글자(tone 10)와의 대비는 11.6:1 로 여전히 충분하다
    ('tertiary-container',      'tertiary', 85),
    ('on-tertiary-container',   'tertiary', 10),

    ('error',                   'error', 40),
    ('on-error',                'error', 100),
    ('error-container',         'error', 90),
    ('on-error-container',      'error', 10),

    ('surface',                 'neutral', 98),
    ('on-surface',              'neutral', 10),
    ('surface-variant',         'neutral-variant', 90),
    ('on-surface-variant',      'neutral-variant', 30),
    # 표면 단계. M3 는 그림자 대신 이 단계로 높이를 표현한다
    ('surface-container-lowest', 'neutral', 100),
    ('surface-container-low',    'neutral', 96),
    ('surface-container',        'neutral', 94),
    ('surface-container-high',   'neutral', 92),
    ('surface-container-highest','neutral', 90),

    ('outline',                 'neutral-variant', 50),
    ('outline-variant',         'neutral-variant', 80),
]


def emit_css() -> str:
    lines = []
    w = lines.append

    w('/*')
    w(' * Inno Extension 디자인 토큰')
    w(' * ==========================')
    w(' *')
    w(' * **손으로 쓰지 않는다. `design/generate-tokens.py` 가 만든다.**')
    w(' *')
    w(' *     python3 design/generate-tokens.py > design/tokens.css')
    w(' *')
    w(' * ## Material 3 의 전략을 따른다')
    w(' *')
    w(' * 색을 하나씩 고르지 않는다. **원천 색에서 색조 팔레트를 뽑고, 색조를 역할에 배정한다.**')
    w(' * 새 색이 필요하면 값을 찍는 게 아니라 어느 역할인지를 정한다.')
    w(' *')
    w(' * | M3 개념 | 여기서 |')
    w(' * | --- | --- |')
    w(' * | 색조 팔레트 | 원천 네 색에서 계산. primary·secondary·tertiary·neutral·neutral-variant·error |')
    w(' * | 역할 | `primary` / `on-primary` / `primary-container` … 밝은 배색 배정 규칙 그대로 |')
    w(' * | 표면 단계 | 그림자 대신 `surface-container-*` 로 높이를 표현 |')
    w(' * | 상태 레이어 | hover·focus·pressed 를 `on-*` 색의 불투명도로. 색을 따로 만들지 않는다 |')
    w(' * | 모양 스케일 | none → full 단계 |')
    w(' * | 4dp 격자 | 간격을 4의 배수로 |')
    w(' *')
    w(' * ## 우리 맥락에 맞춘 것')
    w(' *')
    w(' * 타입 스케일은 M3 이름(label/body/title)을 쓰되 **크기를 줄였다.** M3 의 display·headline 은')
    w(' * 앱 화면용이고, 우리 UI 는 남의 화면에 얹히는 작은 조각이라 쓸 자리가 없다.')
    w(' *')
    w(' * 어두운 배색은 아직 만들지 않았다. Jira·Confluence 다크 모드를 지원할 때 같은 팔레트에서')
    w(' * 배정만 바꿔 뽑으면 된다.')
    w(' *')
    w(' * 원천 — Figma 색상 조합 59 「요트 클럽」')
    for key, value in SOURCE.items():
        w(f' *   {key:<8} {value}')
    w(' *')
    w(' * ## 이름에 `--inno-` 를 붙이는 이유')
    w(' *')
    w(' * 우리 UI 는 Shadow DOM 안에 산다. 그런데 **CSS 사용자 지정 속성은 shadow 경계를 넘어')
    w(' * 상속된다.** 호스트에 `all: initial` 을 걸어도 마찬가지다 — `all` 은 사용자 지정 속성을')
    w(' * 건드리지 않는다. Jira 가 `--surface` 를 쓰고 있으면 우리 것과 섞인다.')
    w(' */')
    w('')
    w(':root,')
    w(':host {')

    w('  /* ===== 색조 팔레트 (참고용. 역할을 쓰고 이걸 직접 쓰지 않는다) ===== */')
    for name, tones in PALETTES.items():
        w(f'  /* {name} */')
        w('  ' + ' '.join(f'--inno-{name}-{t}: {tones[t]};' for t in [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 100]))
    w('')

    w('  /* ===== 역할 — 실제로 쓰는 것 ===== */')
    for role, pal, tone in ROLES:
        anchor = ROLE_ANCHORS.get(role)
        if anchor:
            w(f'  --inno-{role}: {anchor.lower()};  /* 원천 색 그대로 ({pal}-{tone} 자리) */')
        else:
            w(f'  --inno-{role}: {PALETTES[pal][tone]};  /* {pal}-{tone} */')
    w('')

    w('  /*')
    w('   * ===== 상태 레이어 =====')
    w('   *')
    w('   * M3 는 hover 색을 따로 만들지 않는다. **바탕 위에 `on-*` 색을 옅게 덮는다.**')
    w('   * 어떤 배경에 올려도 같은 규칙이 먹고, 색이 두 배로 늘지 않는다.')
    w('   */')
    w('  --inno-state-hover: 0.08;')
    w('  --inno-state-focus: 0.10;')
    w('  --inno-state-pressed: 0.12;')
    w('')

    w('  /* ===== 타입 스케일 (M3 이름, 우리 크기) ===== */')
    w('  --inno-font: -apple-system, BlinkMacSystemFont, "Segoe UI", "Apple SD Gothic Neo",')
    w('    "Malgun Gothic", sans-serif;')
    w('  --inno-font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;')
    w('')
    w('  --inno-label-sm: 11px;   --inno-label-sm-lh: 16px;   --inno-label-sm-weight: 500;')
    w('  --inno-label-md: 12px;   --inno-label-md-lh: 16px;   --inno-label-md-weight: 500;')
    w('  --inno-label-lg: 13px;   --inno-label-lg-lh: 20px;   --inno-label-lg-weight: 600;')
    w('  --inno-body-sm: 11px;    --inno-body-sm-lh: 16px;')
    w('  --inno-body-md: 12px;    --inno-body-md-lh: 18px;')
    w('  --inno-body-lg: 13px;    --inno-body-lg-lh: 20px;')
    w('  --inno-title-sm: 13px;   --inno-title-sm-lh: 20px;   --inno-title-sm-weight: 600;')
    w('  --inno-title-md: 15px;   --inno-title-md-lh: 22px;   --inno-title-md-weight: 600;')
    w('')

    w('  /* ===== 모양 스케일 ===== */')
    w('  --inno-shape-none: 0;')
    w('  --inno-shape-xs: 4px;')
    w('  --inno-shape-sm: 6px;')
    w('  --inno-shape-md: 10px;')
    w('  --inno-shape-lg: 14px;')
    w('  --inno-shape-full: 999px;')
    w('')

    w('  /* ===== 간격 — 4dp 격자 ===== */')
    for i, v in enumerate([4, 8, 12, 16, 20, 24], start=1):
        w(f'  --inno-space-{i}: {v}px;')
    w('')

    w('  /*')
    w('   * ===== 높이 =====')
    w('   *')
    w('   * M3 는 그림자 대신 **표면 단계**로 높이를 표현한다. 떠 있는 것일수록 진한 표면을 쓴다.')
    w('   * 다만 남의 화면 위에 덮는 판은 경계가 분명해야 해서 그림자를 함께 쓴다.')
    w('   */')
    w('  --inno-elevation-0: var(--inno-surface);')
    w('  --inno-elevation-1: var(--inno-surface-container-low);')
    w('  --inno-elevation-2: var(--inno-surface-container);')
    w('  --inno-elevation-3: var(--inno-surface-container-high);')
    w('  --inno-shadow-1: 0 1px 2px rgba(0, 0, 0, 0.12);')
    w('  --inno-shadow-3: 0 8px 20px rgba(0, 0, 0, 0.16);')
    w('')

    w('  /* ===== 조작 요소 높이 =====')
    w('   * 남의 화면에 얹히므로 크게 만들지 않는다. `sm` 이 기본이다. */')
    w('  --inno-control-sm: 24px;')
    w('  --inno-control-md: 32px;')
    w('}')
    w('')
    w('/*')
    w(' * 주입 UI 의 껍데기.')
    w(' *')
    w(' * 남의 페이지 스타일이 새어 들어오지 않게 `all: initial` 로 끊고 필요한 것만 다시 켠다.')
    w(' */')
    w('.inno-root {')
    w('  all: initial;')
    w('  font-family: var(--inno-font);')
    w('  color: var(--inno-on-surface);')
    w('}')
    return '\n'.join(lines) + '\n'


def emit_ts() -> str:
    """
    주입 UI 가 Shadow DOM 안에서 쓸 토큰 문자열을 TS 모듈로 뽑는다.

    `:root` 가 아니라 `:host` 다. shadow root 는 `:root` 에 걸리지 않는다.

    공백을 눌러 한 줄로 만든다. 13개 shadow root 마다 파싱되므로 짧을수록 좋고,
    사람이 읽을 일은 `design/tokens.css` 쪽에서 본다.
    """
    import re
    body = re.sub(r'/\*.*?\*/', '', emit_css(), flags=re.S)
    block = re.search(r':root,?[^{]*\{(.*?)\n\}', body, flags=re.S).group(1)
    mini = re.sub(r'\s*\n\s*', '', block)
    # `;` `:` `,` 뒤의 공백은 의미가 없다. 값 안의 공백(font 목록, box-shadow)은 남긴다.
    mini = re.sub(r'\s*([;:,])\s*', r'\1', mini).strip()
    count = len(re.findall(r'--inno-[\w-]+:', mini))

    return f"""/**
 * 주입 UI 공용 디자인 토큰.
 *
 * **손으로 쓰지 않는다. `design/generate-tokens.py` 가 만든다.**
 *
 *     python3 design/generate-tokens.py --ts > src/platform/design/tokens.ts
 *
 * 값의 뜻과 배정 규칙은 `design/tokens.css` 와 `design/README.md` 에 있다.
 * 이 파일은 그것을 런타임이 쓸 수 있는 형태로 옮긴 것뿐이다.
 *
 * ## 왜 문자열 하나인가
 *
 * 각 기능의 `<style>` 에 그대로 끼워 넣는다. 토큰을 선언하는 자리가 여기 하나뿐이라
 * 색 하나를 바꿔도 13개 파일을 돌아다닐 일이 없다.
 *
 * 호스트 요소에 `setProperty` 로 얹는 방법도 되지만 **더 느리다.** 실측에서 토큰
 * {count}개 · shadow root 13개 기준으로 CSS 파싱은 0.53ms, `setProperty` 는 3.33ms 였다.
 * JS 호출이 CSS 파서보다 비싸다.
 *
 * ## `:root` 가 아니라 `:host` 인 이유
 *
 * shadow root 는 `:root` 에 걸리지 않는다. `:host` 가 shadow 의 최상위다.
 *
 * ## 주의
 *
 * 우리가 토큰을 선언하지 않으면 **페이지의 같은 이름 변수가 그 자리를 차지한다.**
 * 커스텀 속성은 shadow 경계를 넘어 상속되고 `all: initial` 도 그것을 막지 못한다
 * (Chrome 실측). `--inno-` 접두사와 이 선언이 함께 있어야 막힌다.
 */

/** 토큰 {count}개의 선언만. 선택자가 없으므로 그대로 쓰지 말고 아래 둘 중 하나를 쓴다. */
const DECLARATIONS = '{mini}';

/**
 * Shadow DOM 용. `<style>` 맨 앞에 넣는다.
 *
 * ```ts
 * shadow.innerHTML = `<style>${{DESIGN_TOKENS}}${{BUTTON_CSS}}</style>…`;
 * ```
 */
export const DESIGN_TOKENS = `:host{{${{DECLARATIONS}}}}`;

/**
 * 페이지에 직접 넣는 `<style>` 용.
 *
 * 아마란스처럼 Shadow DOM 을 쓰지 않고 주입 루트 id 로 범위를 잡는 기능이 있다.
 * 거기서는 `:host` 가 걸리지 않으므로 그 루트 선택자로 선언한다.
 *
 * ```ts
 * const css = `${{designTokensFor(`#${{INJECTED_ID}}`)}} …`;
 * ```
 *
 * **`:root` 에 넣지 않는다.** 남의 페이지 전역에 우리 변수를 뿌리게 된다.
 */
export function designTokensFor(selector: string): string {{
  return `${{selector}}{{${{DECLARATIONS}}}}`;
}}
"""


def emit_popup_css() -> str:
    """
    Popup 이 `@import` 할 토큰 파일.

    Popup 은 **우리 확장의 페이지**라 남의 CSS 와 싸울 일이 없다. 그래서 Shadow DOM 도,
    `--inno-` 범위를 좁히는 일도 필요 없이 `:root` 에 그대로 선언한다.

    `design/tokens.css` 를 그대로 쓰지 않는 이유는 그 폴더가 빌드에 들어가지 않기 때문이다.
    생성물만 `src/` 로 보낸다.
    """
    import re
    body = re.sub(r'/\*.*?\*/', '', emit_css(), flags=re.S)
    # 선택자(`:root, :host`)까지 그대로 가져온다. Popup 에는 `:root` 가 걸린다.
    block = re.search(r'(:root[^{]*\{.*?\n\})', body, flags=re.S).group(1)
    # 생성물이지만 우리 페이지에서만 쓰므로 사람이 읽을 수 있게 줄을 살려 둔다.
    block = re.sub(r'\n\s*\n+', '\n', block)
    return (
        '/*\n'
        ' * Popup 디자인 토큰\n'
        ' *\n'
        ' * **손으로 쓰지 않는다.** `npm run design:sync` 가 만든다.\n'
        ' * 값의 뜻과 배정 규칙은 `design/tokens.css` 와 `design/README.md` 에 있다.\n'
        ' */\n\n'
        + block + '\n'
    )


if __name__ == '__main__':
    import json, sys
    if '--popup-css' in sys.argv:
        print(emit_popup_css(), end='')
    elif '--ts' in sys.argv:
        print(emit_ts(), end='')
    elif '--json' in sys.argv:
        print(json.dumps({
            'source': SOURCE, 'seed': SEED, 'hue': round(SEED_HUE, 1), 'chroma': round(SEED_CHROMA, 1),
            'palettes': PALETTES,
        }, indent=1))
    else:
        print(emit_css(), end='')
