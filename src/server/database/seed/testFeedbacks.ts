import { DbUser } from '../schemas'

export function getSampleFeedbacks(users: {
    testUser: DbUser
    adminUser: DbUser
    demoUser?: DbUser
}) {
    const { testUser, adminUser, demoUser } = users

    return [
        {
            authorId: testUser.id,
            targetType: 'academic' as const,
            targetDesc: '计算机学院教务办',
            title: '课程安排建议',
            content: '希望下学期能增加Python编程课的实践环节，现在的理论课太多，实践太少。建议每周增加2学时的实验课。',
            isAnonymous: false,
            status: 'pending' as const,
        },
        {
            authorId: testUser.id,
            targetType: 'office' as const,
            targetDesc: '学生事务办公室',
            title: '奖学金申请问题',
            content: '请问国家奖学金的申请截止日期是什么时候？需要准备哪些材料？另外，成绩单需要去哪里打印？',
            isAnonymous: true,
            status: 'processing' as const,
        },
        {
            authorId: demoUser?.id || testUser.id,
            targetType: 'general' as const,
            targetDesc: '校园网络',
            title: '宿舍网络不稳定',
            content: '最近一周12号宿舍楼网络经常断线，尤其是在晚上8-10点高峰期，严重影响学习和上网课。',
            isAnonymous: false,
            status: 'processing' as const,
        },
        {
            authorId: testUser.id,
            targetType: 'academic' as const,
            targetDesc: '图书馆',
            title: '延长开放时间建议',
            content: '考试周期间，建议图书馆延长开放时间到晚上12点，方便同学们复习。现在10点就关门太早了。',
            isAnonymous: false,
            status: 'resolved' as const,
            // adminReply: '感谢您的建议！经研究决定，考试周期间图书馆将开放到24:00，同时增加自习室座位。',
            resolvedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7天前
        },
        {
            authorId: demoUser?.id || testUser.id,
            targetType: 'office' as const,
            targetDesc: '后勤处',
            title: '食堂菜品问题',
            content: '二食堂三楼的麻辣香锅太咸了，而且价格偏贵，希望能调整口味和价格。',
            isAnonymous: true,
            status: 'invalid' as const,
            // adminReply: '经核实，该窗口已暂停营业进行整改，建议您暂时去其他窗口就餐。',
            resolvedAt: new Date(),
        },
        {
            authorId: adminUser.id,
            targetType: 'general' as const,
            targetDesc: '校园环境',
            title: '建议增加垃圾桶',
            content: '操场周围垃圾桶太少，很多同学随手扔垃圾，建议每隔100米设置一个垃圾桶。',
            isAnonymous: false,
            status: 'pending' as const,
        },
        {
            authorId: testUser.id,
            targetType: 'academic' as const,
            targetDesc: '教务处',
            title: '选课系统问题',
            content: '选课系统在高峰期经常崩溃，建议优化服务器性能或者采用排队机制。',
            isAnonymous: false,
            status: 'processing' as const,
        },
        {
            authorId: demoUser?.id || testUser.id,
            targetType: 'office' as const,
            targetDesc: '宿管中心',
            title: '宿舍维修申请',
            content: '13号楼502室空调不制冷，已经报修一周了还没人来修，天气太热了。',
            isAnonymous: false,
            status: 'processing' as const,
        },
    ]

}