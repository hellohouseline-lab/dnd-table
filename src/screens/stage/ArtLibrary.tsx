import { useRef, useState } from 'react'
import { cx } from '../../components/cx.ts'
import { Icon } from '../../components/Icon.tsx'
import { StoredImage } from '../../components/StoredImage.tsx'
import {
  ART_CATEGORIES,
  STARTER_ART,
  starterMapUrl,
  type ArtCategory,
  type Asset,
  type StarterArt,
} from '../../live/library.ts'
import styles from './StageView.module.css'

type ArtLibraryProps = {
  art: Asset[]
  onStage: string | null
  onShow: (asset: Asset) => void
  onUpload: (files: File[], category: ArtCategory) => Promise<void>
  onDelete: (asset: Asset) => void
  /** Adds one of the pictures or maps that come with the table. */
  onAddStarter?: (starter: StarterArt) => Promise<void>
}

/** The art library from design 11: your pictures by kind; click one to put it on stage. */
export function ArtLibrary({ art, onStage, onShow, onUpload, onDelete, onAddStarter }: ArtLibraryProps) {
  const [category, setCategory] = useState<ArtCategory>('places')
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const shown = art.filter((a) => a.category === category)
  const about = ART_CATEGORIES.find((c) => c.key === category)
  const starters = STARTER_ART.filter(
    (s) => s.category === category && !art.some((a) => a.category === category && a.name === s.name),
  )

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return
    setBusy(true)
    await onUpload([...files], category)
    setBusy(false)
    if (input.current) input.current.value = ''
  }

  return (
    <section className={cx(styles.panel, styles.library)} aria-labelledby="art-title">
      <div className={styles.libraryBar}>
        <h2 id="art-title" className={styles.panelTitle}>
          Art library
        </h2>
        <div role="tablist" aria-label="Kinds of art" className={styles.artTabs}>
          {ART_CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={category === c.key}
              className={cx(styles.artTab, category === c.key && styles.artTabOn)}
              onClick={() => setCategory(c.key)}
            >
              {c.name}
            </button>
          ))}
        </div>
        <span className={styles.spacer} />
        <label className={cx(styles.uploadButton, busy && styles.busy)}>
          <Icon name="upload" size={16} />
          {busy ? 'Uploading…' : 'Add pictures'}
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={busy}
            onChange={(event) => void upload(event.target.files)}
          />
        </label>
      </div>
      {starters.length > 0 && onAddStarter && (
        <div className={styles.starters} aria-label="Pictures that come with the table">
          <span className={styles.startersTitle}>
            {category === 'maps' ? 'Maps that come with the table:' : 'An example to try the stage with:'}
          </span>
          {starters.map((starter) => (
            <button
              key={starter.file}
              type="button"
              className={styles.starter}
              title={starter.hint}
              disabled={busy}
              onClick={() => {
                setBusy(true)
                void onAddStarter(starter).finally(() => setBusy(false))
              }}
            >
              <img src={starterMapUrl(starter)} alt="" />
              <span>Add {starter.name}</span>
            </button>
          ))}
        </div>
      )}
      {shown.length === 0 ? (
        <p className={styles.emptyNote}>
          No {about?.name.toLowerCase()} yet ({about?.hint.toLowerCase()}). Add pictures you&rsquo;ve bought or made:
          JPG, PNG or WebP. They&rsquo;re shrunk to fit a screen before upload and kept for every session.
        </p>
      ) : (
        <ul className={styles.artGrid}>
          {shown.map((asset) => (
            <li key={asset.id} className={cx(styles.artTile, asset.id === onStage && styles.artOnStage)}>
              <button
                type="button"
                className={styles.artButton}
                title={asset.id === onStage ? 'On stage now' : 'Put this on stage for everyone'}
                onClick={() => onShow(asset)}
              >
                <span className={styles.artThumb}>
                  <StoredImage path={asset.thumbPath ?? asset.path} alt="" />
                </span>
                <span className={styles.artName}>{asset.name}</span>
                {asset.id === onStage && <span className={styles.liveTag}>On stage</span>}
              </button>
              <button
                type="button"
                className={styles.remove}
                aria-label={`Remove ${asset.name} from the library`}
                onClick={() => onDelete(asset)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
