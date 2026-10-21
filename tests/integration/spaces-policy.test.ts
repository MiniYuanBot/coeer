import { describe, expect, it } from 'vitest'
import template from '../../config/official.meeting-contract.example.json'
import { addDays, today, timeLabel } from '../../src/shared/open-space/domain'
import { parseOfficialConfig } from '../../src/server/open-space/adapters/official/config'
import { LiveOfficialAdapter } from '../../src/server/open-space/adapters/official/live'
import { parseMeetingConfiguration, spaceKey } from '../../src/server/open-space/adapters/official/parsers'
import type { OfficialBinding } from '../../src/server/open-space/adapters/official/bindings'
import type { OfficialTransport, Operation, OfficialResponse } from '../../src/server/open-space/adapters/official/http'
import type { CreateCommand } from '../../src/server/open-space/adapters/adapter'

const baseURL = 'https://synthetic-official.invalid/meeting/'
const roomIds = ['room-one', 'room-two', 'room-three', 'additional-room', 'denied-room']
const targetDate = () => addDays(today(), 90)
const configuration = (rulesSource: 'upstream' | 'contract' = 'upstream') => parseOfficialConfig({
    baseURL, rulesSource, modules: ['meeting'], horizon: 1,
    account: { alias: 'synthetic-account', profileUserId: 'synthetic-profile', bookingPersonId: 'synthetic-operator', contact: '合成测试联系说明' },
    writes: {
        enabled: true,
        ...(rulesSource === 'contract' ? { authorization: {
            approvalRef: 'synthetic-legacy-scope', validFrom: '2020-01-01T00:00:00Z', validUntil: '2099-01-01T00:00:00Z',
            accountAlias: 'synthetic-account', profileUserId: 'synthetic-profile', bookingPersonId: 'synthetic-operator', externalUserIds: ['coeer-student'],
            scopes: [{ module: 'meeting', officialId: roomIds[0], dates: [addDays(today(), 1)], start: 615, end: 795, operations: ['initialize', 'create', 'cancel'] }],
        } } : {}),
        contract: { ...template, rules: rulesSource === 'contract' ? [{ officialId: roomIds[0], stepMinutes: 45, maxMinutes: 45, approval: false, firstDate: today(), lastDate: addDays(today(), 1) }] : [] },
    },
})
function slots(roomId: string) {
    return {
        ROOMMEETING_ID: roomId, OPEN_TIME: '10:15', CLOSE_TIME: '13:15', SCALE_VALUE: 45, PCRF_COST: 0,
        TIME_LIMIT: '0', AUDIT_FLAG: '0',
        data: Array.from({ length: 4 }, (_, index) => ({ staTime: timeLabel(615 + index * 45), endTime: timeLabel(660 + index * 45), className: 'green' })),
    }
}
function fixture(rulesSource: 'upstream' | 'contract' = 'upstream') {
    const config = configuration(rulesSource)
    const calls: { operation: Operation; form: Record<string, string> }[] = []
    const bindings = new Map<string, OfficialBinding>()
    const control = { verifyCode: '1', revoked: false, disabled: false, saved: {} as Record<string, string> }
    const result = (value: unknown): OfficialResponse => ({ status: 200, body: typeof value === 'string' ? value : JSON.stringify(value), contentType: 'application/json', location: null })
    const transport: OfficialTransport = { session: async () => ({ request: async (operation, query, form, options) => {
        await options?.beforeSend?.()
        calls.push({ operation, form })
        if (operation === 'profile') return result({ list: [{ USER_ID: 'synthetic-profile' }] })
        if (operation === 'meetingList') {
            const date = form.MEETING_DATE
            return result(`<html><head><base href="${baseURL}"></head><body><form id="Form" action="meeting/reList.do" method="post"><input id="MEETING_DATE" value="${date}"></form><div class="details">${roomIds.map(id => `<dl data-visible="${id === 'denied-room' || (control.revoked && id === 'additional-room') ? '0' : '1'}"><dt><span class="louceng">合成楼层</span><span class="zhuangtai">${control.disabled ? '停用中' : '空闲中'}</span></dt><dt><ol><li>合成空间 ${id}</li><li>容纳人数：12</li><li class="ptss">配套设施：白板</li></ol></dt><dt><ul>${slots(id).data.map(slot => `<li class="planItem green" data="{'id':'${id}','staTime':'${slot.staTime}','endTime':'${slot.endTime}','date':'${date}'}"></li>`).join('')}</ul></dt></dl>`).join('')}</div><div class="pagination"><span>共5条 共1页</span><li class="active">1</li><select name="showCount"><option value="50" selected>50</option></select></div></body></html>`)
        }
        if (operation === 'meetingSlots') return result(slots(form.ROOMMEETING_ID))
        if (operation === 'initialize') return result({ pd: {
            MEETING_APPLY_ID: 'synthetic-reference', ROOMMEETING_ID: /'id':'([^']+)'/.exec(query.data)?.[1],
            MEETING_PERSON: 'synthetic-operator', NAME: '合成操作人', deptName: '合成部门', roomName: '合成空间', PLACE: '合成地点', FLOOR: '1',
            name: '合成操作人', username: 'synthetic-operator', PCRF_COST: 0, PCRF_TIME: 1,
        }, labelList: [{ SET_CODE: 'synthetic-label' }] })
        if (operation === 'verify') return result({ code: control.verifyCode })
        if (operation === 'create') { control.saved = form; return result('<html>synthetic redirect receipt</html>') }
        if (operation === 'meetingDetail') return result({ pd: {
            MEETING_APPLY_ID: 'synthetic-reference', ROOMMEETING_ID: control.saved.ROOMMEETING_ID,
            MEETING_PERSON: 'synthetic-operator', START_DATE: control.saved.START_DATE, END_DATE: control.saved.END_DATE,
            START_TIME: control.saved.START_TIME, END_TIME: control.saved.END_TIME, STATUS: '1',
        } })
        throw new Error('Unexpected synthetic operation')
    } }) }
    const adapter = new LiveOfficialAdapter(config, transport, {
        get: async ref => bindings.get(ref), byRequest: async id => [...bindings.values()].find(binding => binding.requestId === id),
        put: async binding => { bindings.set(binding.ref, binding) },
    })
    const command: CreateCommand = { requestId: 'coeer-upstream-policy', externalUserId: 'coeer-student', spaceId: spaceKey('meeting', 'additional-room'), module: 'meeting', date: targetDate(), start: 615, end: 750, quantity: 1, purpose: '合成官方规则测试' }
    return { adapter, command, calls, control }
}

describe('COEER official server rules', () => {
    it('submits a persisted room after a cold process start using one fresh target-room read', async () => {
        const { adapter, command, calls } = fixture()
        expect(adapter.catalogComplete).toBe(false)
        expect(await adapter.create(command)).toEqual({ ref: 'synthetic-reference' })
        expect(calls.filter(call => call.operation === 'meetingList')).toHaveLength(1)
        expect(calls.filter(call => call.operation === 'meetingSlots').map(call => call.form.ROOMMEETING_ID)).toEqual(['additional-room'])
        expect(calls.filter(call => call.operation === 'profile')).toHaveLength(2)
        expect(calls.filter(call => call.operation === 'verify')).toHaveLength(1)
        expect(calls.filter(call => call.operation === 'create')).toHaveLength(1)
        expect(calls.filter(call => call.operation === 'meetingDetail')).toHaveLength(1)
        expect(adapter.publication(command.spaceId)?.officialId).toBe('additional-room')
        expect(adapter.catalogComplete).toBe(false)
    })
    it.each(['denied-room', 'missing-room'])('rejects a cold-start submission for %s before initialization or save', async roomId => {
        const { adapter, command, calls } = fixture()
        await expect(adapter.create({ ...command, spaceId: spaceKey('meeting', roomId) })).rejects.toMatchObject({ code: 'CONFLICT' })
        expect(calls.filter(call => ['meetingSlots', 'initialize', 'verify', 'create'].includes(call.operation))).toHaveLength(0)
        expect(adapter.publication(spaceKey('meeting', roomId))).toBeUndefined()
    })
    it('uses every permitted meeting room, the official grid, and final verify without static date or duration limits', async () => {
        const { adapter, command, calls } = fixture()
        const sources = await adapter.listSpaces()
        expect(adapter.rulesSource).toBe('upstream')
        expect(adapter.publicationGrants().map(grant => grant.officialId)).toEqual(roomIds.slice(0, 4))
        expect(adapter.publication(spaceKey('meeting', 'denied-room'))).toBeUndefined()
        expect(sources.find(source => source.id === command.spaceId)?.policy).toMatchObject({ rulesSource: 'upstream', stepMinutes: 45, maxMinutes: 0, rulesVerified: true, approvalKnown: false })
        expect(() => adapter.checkCreate(command)).not.toThrow()
        calls.length = 0
        expect(await adapter.create(command)).toEqual({ ref: 'synthetic-reference' })
        expect(calls.filter(call => call.operation === 'meetingSlots').map(call => call.form.ROOMMEETING_ID)).toEqual(['additional-room'])
        expect(calls.find(call => call.operation === 'verify')?.form).toMatchObject({ START_DATE: targetDate(), START_TIME: '10:15', END_TIME: '12:30' })
        expect(calls.filter(call => call.operation === 'create')).toHaveLength(1)
    })
    it('treats official verify rejection as final and sends no save request', async () => {
        const { adapter, command, calls, control } = fixture()
        await adapter.listSpaces()
        control.verifyCode = '0'
        await expect(adapter.create(command)).rejects.toMatchObject({ code: 'RULE_REJECTED' })
        expect(calls.filter(call => call.operation === 'verify')).toHaveLength(1)
        expect(calls.filter(call => call.operation === 'create')).toHaveLength(0)
    })
    it('rechecks current official permissions before initialization even after an earlier allowed catalog', async () => {
        const { adapter, command, calls, control } = fixture()
        await adapter.listSpaces()
        await adapter.availability(command.spaceId, command.date)
        calls.length = 0
        control.revoked = true
        await expect(adapter.create(command)).rejects.toMatchObject({ code: 'CONFLICT' })
        expect(calls.filter(call => call.operation === 'meetingList')).toHaveLength(1)
        expect(calls.filter(call => call.operation === 'meetingSlots')).toHaveLength(0)
        expect(calls.filter(call => ['initialize', 'create'].includes(call.operation))).toHaveLength(0)
    })
    it('never treats a single-room preflight as a complete date batch for background synchronization', async () => {
        const { adapter, command, calls, control } = fixture()
        await adapter.listSpaces()
        control.verifyCode = '0'
        await expect(adapter.create(command)).rejects.toMatchObject({ code: 'RULE_REJECTED' })
        calls.length = 0
        await adapter.availability(spaceKey('meeting', 'room-one'), command.date)
        expect(calls.filter(call => call.operation === 'meetingSlots').map(call => call.form.ROOMMEETING_ID)).toEqual(roomIds.slice(0, 4))
        const count = calls.length
        await adapter.availability(spaceKey('meeting', 'room-two'), command.date)
        expect(calls).toHaveLength(count)
    })
    it('marks fresh upstream-disabled rooms unavailable without waiting for a catalog sync', async () => {
        const { adapter, command, control, calls } = fixture()
        await adapter.listSpaces()
        control.disabled = true
        const snapshot = await adapter.availability(command.spaceId, command.date)
        expect(snapshot.slots).toHaveLength(4)
        expect(snapshot.slots.every(slot => slot.state === 'unopened')).toBe(true)
        expect(calls.filter(call => ['initialize', 'create'].includes(call.operation))).toHaveLength(0)
    })
    it('keeps static contract restrictions available without guessing upstream date or approval codes', async () => {
        const { adapter, command } = fixture('contract')
        await adapter.listSpaces()
        expect(adapter.rulesSource).toBe('contract')
        expect(() => adapter.checkCreate(command)).toThrow('AUTHORIZATION_REQUIRED')
        const parsed = parseMeetingConfiguration(JSON.stringify({ ...slots('room'), TIME_LIMIT: 0, AUDIT_FLAG: 1 }), 'room')
        expect(parsed.metadata).toMatchObject({ stepMinutes: 45, slotGridVerified: true, configuration_TIME_LIMIT: '0', configuration_AUDIT_FLAG: '1', configurationCodesVerified: false })
        expect(parsed.metadata).not.toHaveProperty('maxMinutes')
        expect(parsed.metadata).not.toHaveProperty('lastDate')
    })
})
