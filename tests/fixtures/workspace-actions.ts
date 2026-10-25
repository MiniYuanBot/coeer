// UI-only action substitutes. No database, auth session, or upstream booking calls.
const action = async (..._args: unknown[]): Promise<any> => ({ success: true, state: {}, data: { items: [], total: 0 } })
export const adminCreateAchievementFn = action,
    adminCreateCardFn = action,
    adminDeleteCardFn = action,
    adminCreateRedeemItemFn = action,
    adminDeleteAchievementFn = action,
    adminDeleteRedeemItemFn = action,
    adminListRedeemItemsFn = action,
    adminListRedeemOrdersFn = action,
    adminUpdateAchievementFn = action,
    adminUpdateCardFn = action,
    adminUpdateRedeemItemFn = action,
    cancelRegistrationFn = action,
    changePasswordFn = action,
    checkRoleFn = action,
    computeDormFn = action,
    confirmDormFn = action,
    createActivityFn = action,
    createBulletinFn = action,
    createDormCycleFn = action,
    createFeedbackFn = action,
    createGroupFn = action,
    createGroupPostFn = action,
    createReplyFn = action,
    deleteActivityFn = action,
    deleteBulletinFn = action,
    deleteGroupPostFn = action,
    deleteReplyFn = action,
    drawCardsFn = action,
    fetchUserFn = action,
    getActivityByIdFn = action,
    getActivityParticipantsFn = action,
    getAllAchievementsFn = action,
    getBulletinByIdFn = action,
    getBulletinFeedFn = action,
    getCardPoolFn = action,
    getDormAdminOverviewFn = action,
    getDormQuestionnaireConfigFn = action,
    getDormStudentViewFn = action,
    getFeedbackByIdFn = action,
    getFeedbackStatusLogsFn = action,
    getFeedbacksFn = action,
    getGroupBySlugFn = action,
    getMyGroupMembershipFn = action,
    getGroupMembersFn = action,
    getGroupPostByIdFn = action,
    getMyCardsFn = action,
    getMyPointBalanceFn = action,
    getMyPointHistoryFn = action,
    getRecentPublicPostsFn = action,
    getUnreadNotificationCountFn = async () => 3,
    getUserStatsFn = action,
    joinGroupFn = action,
    listActivitiesFn = action,
    listAdminGroupsFn = action,
    listAllGroupsFn = action,
    listBookmarksFn = action,
    listChildRepliesFn = action,
    listDormCyclesFn = action,
    listMyGroupsFn = action,
    listNotificationsFn = async () => ({ items: [], total: 0, unread: 0 }),
    listPostsByGroupFn = action,
    listRedeemItemsFn = action,
    listRepliesByTargetFn = action,
    markNotificationReadFn = action,
    recordDailyVisitFn = action,
    redeemItemFn = action,
    registerActivityFn = action,
    removeMemberFn = action,
    requestPasswordResetFn = action,
    resetPasswordFn = action,
    setBookmarkFn = action,
    submitDormQuestionnaireFn = action,
    togglePinPostFn = action,
    toggleReactionFn = action,
    updateActivityFn = action,
    updateBulletinFn = action,
    updateDormRoomFn = action,
    updateGroupFn = action,
    updateGroupPostFn = action,
    updateMemberRoleFn = action,
    updateProfileFn = action,
    updateReplyFn = action

export async function updateFeedbackStatusFn({ data }: any) {
    if ((window as any).__feedbackFail) throw new Error('保存失败，请重试')
    const { feedbacks } = await import('./workspace-data')
    Object.assign(feedbacks.find(item => item.id === data.id)!, { status: data.status, isPublic: data.isPublic })
}
export async function deleteFeedbackFn({ data }: any) {
    const { feedbacks } = await import('./workspace-data')
    feedbacks.splice(feedbacks.findIndex(item => item.id === data.id), 1)
}

export async function updateGroupStatusFn({ data }: any) {
    if ((window as any).__groupFail) throw new Error('保存失败，请重试')
    const { adminGroups } = await import('./workspace-data')
    Object.assign(adminGroups.find(item => item.id === data.id)!, data)
}
export async function deleteGroupFn({ data }: any) {
    const { adminGroups } = await import('./workspace-data')
    adminGroups.splice(adminGroups.findIndex(item => item.id === data.groupId), 1)
}
