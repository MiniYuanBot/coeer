import { createRoot } from 'react-dom/client'
import { PostContent } from '../../src/app/components/coeer/cards/PostContent'
import { Markdown } from '../../src/app/components/coeer/ui/Markdown'
import '../../src/app/styles/app.css'

const longPost = Array.from({ length: 18 }, (_, index) => `第 ${index + 1} 步：检查换元后的上下限。令 $u=x^2$，于是 $du=2x\\,dx$。`).join('\n\n')

createRoot(document.getElementById('root')!).render(<main className="mx-auto max-w-3xl space-y-8 p-5">
    <section id="long-post"><PostContent content={longPost} /></section>
    <section id="short-post"><PostContent content="一条简短的帖子。" /></section>
    <section id="formula"><Markdown content={String.raw`行内公式 $x_i^2+\frac{a}{b}$，前后文字保持自然换行。

$$
\sum_{i=1}^{n} x_i^2 + \frac{1+\frac{a}{b}}{\sqrt{1+x^2}} = \int_0^1 x e^{x^2}\,\mathrm{d}x
$$`} /></section>
</main>)
