import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Badge, Card, EmptyState, FilterPanel, Pagination, SectionHeader, formatDateTime, paginate } from '@/components/coeer'
import { Route as DormRoute } from './route'

export const Route = createFileRoute('/_authed/admin/dorms/questionnaires')({ component: DormQuestionnairesPage })

function DormQuestionnairesPage() {
    const overview = DormRoute.useLoaderData()
    return <QuestionnaireRecords key={overview?.activeCycle?.id || 'empty'} />
}

function QuestionnaireRecords() {
    const overview = DormRoute.useLoaderData()
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const rows = paginate((overview?.submissions ?? []).filter(item =>
        [item.user?.name, item.user?.email, item.studentNo, item.college, item.major].join(' ').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())), page)
    return <section className="space-y-6">
        <SectionHeader level="h2" title="问卷记录" description="查看当前届次的提交情况，按姓名、学号、学院或专业查找。" />
        <FilterPanel searchValue={search} searchPlaceholder="搜索姓名、学号、学院或专业" groups={[]}
            onSearch={value => { setSearch(value); setPage(1) }} onClear={() => { setSearch(''); setPage(1) }} />
        {rows.total ? <div className="coeer-grid">
            {rows.items.map(item => <Card key={item.id} className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h3 className="break-words text-[15px] font-medium">{item.user?.name || item.user?.email || '未命名学生'}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">{item.studentNo || '未填学号'} · {item.cohortLabel}</p>
                    </div>
                    <Badge>{{ male: '男', female: '女', other: '其他' }[item.gender]}</Badge>
                </div>
                <p className="break-words text-[13px] text-muted-foreground">{item.college || '未填学院'} · {item.major || '未填专业'}</p>
                <p className="text-xs text-muted-foreground">提交于 {formatDateTime(item.submittedAt)}</p>
            </Card>)}
        </div> : <EmptyState title={search ? '没有匹配的问卷' : '暂无提交记录'} description={search ? '试试其他姓名或学号，或清除筛选。' : '学生提交当前届次的问卷后，会出现在这里。'} />}
        {rows.total > rows.size && <Pagination {...rows} onChange={setPage} />}
    </section>
}
