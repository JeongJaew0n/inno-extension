#!/usr/bin/env python3
"""
`design/components.css` 를 조각별 TS 모듈로 옮긴다.

    python3 design/generate-parts.py > src/platform/design/parts.ts

## 왜 나누나

기능 하나가 컴포넌트 전부를 쓰지 않는다. 복사 버튼 하나 띄우는 기능이 표·스위치 CSS 까지
지고 갈 이유가 없다. 조각을 따로 내보내면 **쓰지 않는 것은 번들에서 빠진다** — 문자열
상수는 부작용이 없어 Rollup 이 지운다.

## 표식

`components.css` 의 각 구역 머리말에 `@part <이름>` 을 적어두면 그 이름으로 내보낸다.
구역이 늘면 CSS 쪽만 고치면 되고 이 스크립트는 건드리지 않는다.

## 주석은 뺀다

읽을 사람은 `design/components.css` 를 본다. 런타임에 실려 가는 문자열에는 필요 없다.
"""

import pathlib
import re
import sys

SOURCE = pathlib.Path(__file__).with_name('components.css')

# `@part` 이름을 TS 상수 이름으로. `switch` 는 예약어라 그대로 쓸 수 없다.
RESERVED = {'switch': 'toggle'}


def minify(css: str) -> str:
    """
    공백을 눌러 한 줄로 만든다.

    값 안의 공백은 의미가 있다(`0 1px 2px rgba(...)`, font 목록). 그래서 줄바꿈과
    구분자 뒤의 공백만 지우고 나머지는 한 칸으로 줄인다.
    """
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    css = re.sub(r'\s+', ' ', css)
    css = re.sub(r'\s*([{};:,>])\s*', r'\1', css)
    # 마지막 선언의 `;` 는 없어도 되지만, 이어 붙일 때를 생각해 남긴다.
    return css.replace('}', '}\n').strip()


def parts() -> list[tuple[str, str]]:
    text = SOURCE.read_text(encoding='utf-8')
    marks = [(m.start(), m.group(1)) for m in re.finditer(r'^ \* @part (\w+)$', text, re.M)]
    if not marks:
        raise SystemExit('components.css 에 @part 표식이 없다')

    found = []
    for index, (start, name) in enumerate(marks):
        end = marks[index + 1][0] if index + 1 < len(marks) else len(text)
        # 표식이 있는 머리말 주석 다음부터가 본문이다.
        body = text[start:end].split('*/', 1)[1]
        found.append((RESERVED.get(name, name), minify(body)))
    return found


def emit() -> str:
    found = parts()
    total = sum(len(css) for _, css in found)

    lines = [
        '/**',
        ' * 주입 UI 공용 컴포넌트 CSS.',
        ' *',
        ' * **손으로 쓰지 않는다. `design/generate-parts.py` 가 만든다.**',
        ' *',
        ' *     npm run design:sync',
        ' *',
        ' * 정본은 `design/components.css` 다. 눈으로 보려면 `design/index.html` 을 연다.',
        ' *',
        ' * ## 쓰는 법',
        ' *',
        ' * 필요한 조각만 골라 `<style>` 에 이어 붙인다. 토큰이 먼저 와야 한다.',
        ' *',
        ' * ```ts',
        ' * shadow.innerHTML = `<style>${DESIGN_TOKENS}${BUTTON_CSS}</style>…`;',
        ' * ```',
        ' *',
        ' * **하나씩 따로 내보낸다.** 객체 하나에 담으면 Rollup 이 속성 단위로 지우지 못해',
        ' * 조각 하나를 쓰려고 전부를 지고 가게 된다.',
        ' */',
        '',
    ]
    for name, css in found:
        lines.append(f'/** {len(css):,}자 */')
        lines.append(f'export const {const_name(name)} = {css_literal(css)};')
        lines.append('')

    lines.append(f'// 조각 {len(found)}개 · CSS 합계 {total:,}자')
    return '\n'.join(lines)


def const_name(name: str) -> str:
    """`stateLayer` -> `STATE_LAYER_CSS`"""
    return re.sub(r'(?<!^)(?=[A-Z])', '_', name).upper() + '_CSS'


def css_literal(css: str) -> str:
    """여러 줄이면 템플릿 리터럴로 쓴다. 규칙마다 줄이 갈려 diff 가 읽힌다."""
    escaped = css.replace('\\', '\\\\').replace('`', '\\`').replace('${', '\\${')
    return f'`{escaped}`' if '\n' in escaped else f"'{escaped}'"


if __name__ == '__main__':
    if '--list' in sys.argv:
        for name, css in parts():
            print(f'{const_name(name):<18} {len(css):>6,}자')
    else:
        print(emit())
