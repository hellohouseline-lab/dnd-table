import { SelectField, TextField } from '../../components/Field.tsx'
import type { CampaignDetails } from '../../live/campaigns.ts'
import styles from './CampaignFields.module.css'

export type CampaignForm = CampaignDetails

const PARTY_SIZES = [1, 2, 3, 4, 5, 6, 7, 8]
const LEVELS = Array.from({ length: 20 }, (_, i) => i + 1)

type CampaignFieldsProps = {
  value: CampaignForm
  onChange: (value: CampaignForm) => void
  /** Only when starting a campaign: the name players will see for the DM. */
  dmName?: string
  onDmNameChange?: (name: string) => void
}

/** The campaign's name, party size and starting level, shared by "Start a campaign" and the DM's settings. */
export function CampaignFields({ value, onChange, dmName, onDmNameChange }: CampaignFieldsProps) {
  return (
    <>
      <TextField
        label="Campaign name"
        hint="Players see this at the top of their screen"
        placeholder="The Sunless Citadel"
        required
        maxLength={80}
        value={value.name}
        onChange={(event) => onChange({ ...value, name: event.target.value })}
      />
      {onDmNameChange && (
        <TextField
          label="Your name at the table"
          hint="Players see &ldquo;Run by&rdquo; and this name under the campaign name"
          placeholder="Matt"
          autoComplete="given-name"
          required
          maxLength={40}
          value={dmName ?? ''}
          onChange={(event) => onDmNameChange(event.target.value)}
        />
      )}
      <div className={styles.pair}>
        <SelectField
          label="Party size"
          value={value.party_size}
          onChange={(event) => onChange({ ...value, party_size: Number(event.target.value) })}
        >
          {PARTY_SIZES.map((size) => (
            <option key={size} value={size}>
              {size === 1 ? '1 player' : `${size} players`}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Starting level"
          value={value.starting_level}
          onChange={(event) => onChange({ ...value, starting_level: Number(event.target.value) })}
        >
          {LEVELS.map((level) => (
            <option key={level} value={level}>
              Level {level}
            </option>
          ))}
        </SelectField>
      </div>
    </>
  )
}
