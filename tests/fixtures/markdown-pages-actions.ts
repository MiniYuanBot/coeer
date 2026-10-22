export const submitted = { action: '', data: {} as Record<string, unknown> }
export const failure = { mode: '' }

function action(name: string) {
    return async ({ data }: { data: Record<string, unknown> }) => {
        const mode = failure.mode
        failure.mode = ''
        if (mode === 'network') throw new Error('网络中断，请重试')
        if (mode === 'response') return { success: false, state: { message: '服务器拒绝保存' } }
        submitted.action = name
        submitted.data = data
        window.dispatchEvent(new Event('markdown-submitted'))
        return { success: true, data: { id: 'created' } }
    }
}

export const createGroupPostFn = action('createPost')
export const updateGroupPostFn = action('updatePost')
export const createFeedbackFn = action('createFeedback')
export const createBulletinFn = action('createBulletin')
export const updateBulletinFn = action('updateBulletin')
export const deleteBulletinFn = action('deleteBulletin')
export const getBulletinFeedFn = action('listBulletins')
export const createActivityFn = action('createActivity')
export const updateActivityFn = action('updateActivity')
export const deleteActivityFn = action('deleteActivity')
export const getActivityParticipantsFn = action('listParticipants')
export const listActivitiesFn = action('listActivities')
