import { api, seg } from './client'
import type { CreatedInvitation, Invitation, InvitationPreview, LeagueAdmin } from './types'

const base = (leagueId: string) => `/leagues/${seg(leagueId)}`

export function listAdmins(leagueId: string): Promise<LeagueAdmin[]> {
  return api<LeagueAdmin[]>('GET', `${base(leagueId)}/admins`)
}

export function removeAdmin(leagueId: string, userId: string): Promise<void> {
  return api('DELETE', `${base(leagueId)}/admins/${seg(userId)}`)
}

export function listInvitations(leagueId: string): Promise<Invitation[]> {
  return api<Invitation[]>('GET', `${base(leagueId)}/invitations`)
}

export function invite(leagueId: string, email: string): Promise<CreatedInvitation> {
  return api<CreatedInvitation>('POST', `${base(leagueId)}/invitations`, { body: { email } })
}

export function cancelInvitation(leagueId: string, invitationId: string): Promise<void> {
  return api('DELETE', `${base(leagueId)}/invitations/${seg(invitationId)}`)
}

export function lookupInvitation(token: string): Promise<InvitationPreview> {
  return api<InvitationPreview>('POST', '/invitations/lookup', { body: { token } })
}

export function acceptInvitation(token: string, account?: { name: string; password: string }): Promise<void> {
  return api('POST', '/invitations/accept', { body: { token, ...account } })
}
