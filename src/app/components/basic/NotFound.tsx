import { Link } from '@tanstack/react-router'
import { Button } from '../coeer'

export function NotFound({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
      <div className="mx-auto max-w-md">
        <h1 className="select-none text-8xl font-black tracking-tight text-border">404</h1>
        <div className="mt-5 text-lg text-foreground">
          {children || (
            <>
              <p className="font-semibold">页面不存在</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                你访问的页面可能已被移除、改名或暂时不可用。
              </p>
            </>
          )}
        </div>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/">
            <Button variant="outline" className="w-full sm:w-auto">
              返回首页
            </Button>
          </Link>
          <Button variant="primary" className="w-full sm:w-auto" onClick={() => window.history.back()}>
            返回上一页
          </Button>
        </div>
      </div>
    </div>
  )
}
