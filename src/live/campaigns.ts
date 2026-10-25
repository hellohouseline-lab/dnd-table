// Reading and changing campaigns and the people at each table. The database's own rules decide
// what each person may see and do; these functions just ask and turn failures into plain words.

import type { Tables } from './database.types.ts'
import { fromDatabaseError, NOT_CONNECTED, TableError } from './errors.ts'
import { supabase } from './supabase.ts'

export type Campaign = Tables<'campaigns'>
export type Member = Tables<'campaign_members'>
export type MyCampaign = { campaign: Campaign; role: Member['role'] }

/** What a join code opens, shown before joining. `campaignId` is set only if you're already there. */
export type CampaignPeek = {
  campaignId: string | null
  name: string
  dmName: string
  partySize: number
  startingLevel: number
}

export type CampaignDetails = Pick<Campaign, 'name' | 'party_size' | 'starting_level'>

function db() {
  if (!supabase) throw new TableError(NOT_CONNECTED)
  return supabase
}

/** Every campaign you're at, DM or player, sorted by name. */
export async function listMyCampaigns(userId: string): Promise<MyCampaign[]> {
  const { data, error } = await db()
    .from('campaign_members')
    .select('role, campaign:campaigns(*)')
    .eq('user_id', userId)
  if (error) throw fromDatabaseError(error)
  return data
    .flatMap((row) => (row.campaign ? [{ campaign: row.campaign, role: row.role }] : []))
    .sort((a, b) => a.campaign.name.localeCompare(b.campaign.name))
}

/** The campaign, or null if it doesn't exist or you're not at that table. */
export async function getCampaign(campaignId: string): Promise<Campaign | null> {
  const { data, error } = await db().from('campaigns').select('*').eq('id', campaignId).maybeSingle()
  if (error) throw fromDatabaseError(error)
  return data
}

/** Everyone at the table, in the order they joined (the DM first). */
export async function listMembers(campaignId: string): Promise<Member[]> {
  const { data, error } = await db()
    .from('campaign_members')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('joined_at')
  if (error) throw fromDatabaseError(error)
  return data
}

/** Starts a campaign with you as its DM. Returns its id. */
export async function createCampaign(details: CampaignDetails & { dmName: string }): Promise<string> {
  const { data, error } = await db().rpc('create_campaign', {
    p_name: details.name,
    p_dm_name: details.dmName,
    p_party_size: details.party_size,
    p_starting_level: details.starting_level,
  })
  if (error) throw fromDatabaseError(error)
  return data
}

/** Which table a join code opens, or null if the code doesn't match one. */
export async function peekCampaign(code: string): Promise<CampaignPeek | null> {
  const { data, error } = await db().rpc('peek_campaign', { p_code: code })
  if (error) throw fromDatabaseError(error)
  const row = data[0]
  if (!row) return null
  return {
    campaignId: row.campaign_id ?? null,
    name: row.name,
    dmName: row.dm_name,
    partySize: row.party_size,
    startingLevel: row.starting_level,
  }
}

/** Joins the table as a player. Returns the campaign's id. */
export async function joinCampaign(code: string, displayName: string): Promise<string> {
  const { data, error } = await db().rpc('join_campaign', { p_code: code, p_display_name: displayName.trim() })
  if (error) throw fromDatabaseError(error)
  return data
}

/** DM only: swaps the join code so the old code and invite link stop working. Returns the new code. */
export async function renewJoinCode(campaignId: string): Promise<string> {
  const { data, error } = await db().rpc('renew_join_code', { p_campaign_id: campaignId })
  if (error) throw fromDatabaseError(error)
  return data
}

/** DM only: changes the campaign's name, party size or starting level. */
export async function updateCampaign(campaignId: string, details: CampaignDetails): Promise<void> {
  const { error } = await db()
    .from('campaigns')
    .update({ ...details, name: details.name.trim() })
    .eq('id', campaignId)
  if (error) throw fromDatabaseError(error)
}

/** DM only: marks whether a player is playing tonight. */
export async function setHereTonight(campaignId: string, userId: string, hereTonight: boolean): Promise<void> {
  const { error } = await db()
    .from('campaign_members')
    .update({ here_tonight: hereTonight })
    .eq('campaign_id', campaignId)
    .eq('user_id', userId)
  if (error) throw fromDatabaseError(error)
}

/** DM only: takes a player away from the table. */
export async function removeMember(campaignId: string, userId: string): Promise<void> {
  const { error } = await db().from('campaign_members').delete().eq('campaign_id', campaignId).eq('user_id', userId)
  if (error) throw fromDatabaseError(error)
}
