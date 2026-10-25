/** Run in the page: opaque content and translucent surfaces must work over any artwork luminance. */
export function findTextContrastFailures() {
    const rgba = (value: string): number[] => {
        const values = value.match(/[\d.]+/g)?.map(Number)
        return values ? [values[0], values[1], values[2], values[3] ?? 1] : [0, 0, 0, 0]
    }
    const composite = (foreground: number[], background: number[]) => foreground.slice(0, 3).map((value, index) => value * foreground[3] + background[index] * (1 - foreground[3]))
    const luminance = (rgb: number[]) => rgb.slice(0, 3).map(value => {
        const v = value / 255
        return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4
    }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0)
    const failures: { text: string; ratio: number; target: number }[] = []
    const visible = (rect: DOMRect) => rect.width > 0 && rect.height > 0 && rect.top < innerHeight && rect.bottom > 0 && rect.left < innerWidth && rect.right > 0
    function check(element: Element, text: string, foreground: string) {
        const styles = []
        // body::before sits above the body fill, so body is deliberately excluded.
        for (let parent: Element | null = element; parent && parent !== document.body; parent = parent.parentElement) styles.unshift(getComputedStyle(parent))
        const style = getComputedStyle(element)
        if (style.visibility !== 'visible') return
        let minimum = Infinity
        for (const endpoint of [0, 64, 128, 192, 255]) {
            let background = [endpoint, endpoint, endpoint]
            for (const ancestor of styles) background = composite(rgba(ancestor.backgroundColor), background)
            const a = luminance(composite(rgba(foreground), background)), b = luminance(background)
            minimum = Math.min(minimum, (Math.max(a, b) + .05) / (Math.min(a, b) + .05))
        }
        const size = parseFloat(style.fontSize), weight = parseFloat(style.fontWeight)
        const target = size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5
        if (minimum + .01 < target) failures.push({ text: text.trim().slice(0, 60), ratio: Number(minimum.toFixed(2)), target })
    }
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
        const node = walker.currentNode, element = node.parentElement
        if (!element || !node.textContent?.trim() || element.closest('script,style,svg,option,[aria-hidden=true]')) continue
        const range = document.createRange()
        range.selectNodeContents(node)
        if ([...range.getClientRects()].some(visible)) check(element, node.textContent, getComputedStyle(element).color)
    }
    for (const field of document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input:not([type=hidden]):not([type=checkbox]):not([type=radio]),textarea')) {
        if (!visible(field.getBoundingClientRect())) continue
        const style = getComputedStyle(field, field.value ? null : '::placeholder')
        check(field, field.value || field.placeholder, style.color)
    }
    return failures
}
