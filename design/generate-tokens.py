#!/usr/bin/env python3
"""
Material 3 전략으로 색조 팔레트를 만든다. 시드는 우리 보라.

빌드와 무관하다. 토큰을 다시 뽑을 때만 손으로 돌린다.

    python3 design/generate-tokens.py > design/tokens.css

## 무엇을 따랐나

M3 는 시드 한 색에서 **색조 팔레트**를 뽑고, 그 팔레트의 특정 색조를 **역할**에 배정한다.
색을 손으로 고르지 않는다 — 시드와 배정 규칙만 정하면 나머지는 계산이다.

M3 는 HCT(CAM16 기반)를 쓴다. 여기서는 **CIELCh** 로 같은 일을 한다. 색조(tone)를 L* 로 두고
색상·채도를 유지하되, sRGB 밖으로 나가면 채도를 이진 탐색으로 줄인다. HCT 의 gamut 해결과
같은 발상이고, 외부 라이브러리 없이 돌릴 수 있다.
"""

SEED = '#654cf2'          # Popup 에서 쓰던 우리 보라
TONES = [0, 4, 6, 10, 12, 17, 20, 22, 24, 30, 40, 50, 60, 70, 80, 87, 90, 92, 94, 95, 96, 98, 100]


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

_L, _a, _b = hex_to_lab(SEED)
SEED_HUE = degrees(atan2(_b, _a)) % 360
SEED_CHROMA = hypot(_a, _b)

PALETTES = {
    # 시드 그대로. 우리 정체성이다
    'primary': palette(SEED_HUE, SEED_CHROMA),
    # M3 는 보조색을 같은 색상에서 채도만 낮춰 뽑는다
    'secondary': palette(SEED_HUE, 16),
    # 강조색은 색상환에서 60도 돌린다
    'tertiary': palette((SEED_HUE + 60) % 360, 24),
    # 중립은 시드 색상의 흔적만 남긴다. 화면 전체가 미묘하게 같은 계열이 된다
    'neutral': palette(SEED_HUE, 4),
    'neutral-variant': palette(SEED_HUE, 8),
    # 오류는 시드와 무관하게 고정한다. 빨강이 아니면 오류로 안 읽힌다
    'error': palette(30, 60),
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
    ('tertiary-container',      'tertiary', 90),
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
    w(' * 색을 하나씩 고르지 않는다. **시드 한 색에서 색조 팔레트를 뽑고, 색조를 역할에 배정한다.**')
    w(' * 새 색이 필요하면 값을 찍는 게 아니라 어느 역할인지를 정한다.')
    w(' *')
    w(' * | M3 개념 | 여기서 |')
    w(' * | --- | --- |')
    w(' * | 색조 팔레트 | 시드에서 계산. primary·secondary·tertiary·neutral·neutral-variant·error |')
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
    w(f' * 시드 {SEED} — hue {SEED_HUE:.1f}° / chroma {SEED_CHROMA:.1f}')
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

/** `<style>` 맨 앞에 넣는다. 토큰 {count}개를 `:host` 에 선언한다. */
export const DESIGN_TOKENS = ':host{{{mini}}}';
"""


if __name__ == '__main__':
    import json, sys
    if '--ts' in sys.argv:
        print(emit_ts(), end='')
    elif '--json' in sys.argv:
        print(json.dumps({
            'seed': SEED, 'hue': round(SEED_HUE, 1), 'chroma': round(SEED_CHROMA, 1),
            'palettes': PALETTES,
        }, indent=1))
    else:
        print(emit_css(), end='')
