import { Check, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { Dispatch, ReactElement, SetStateAction } from 'react'
import type { BirthdayBoardView, BoardSnapshot, BoardSummary, ListSortDirection, WidgetType } from '@shared/domain'
import type { WizardData, WizardListDraft, WizardMode, WizardStepId, WizardTemplateType, WizardWidgetDraft } from '../app/types'
import { ConfirmActionModal } from '../modals/dialogs'

export type WizardHelpers = {
  birthdayBoardViewOptions: Array<{ value: BirthdayBoardView; label: string }>
  createWizardListDraft: (templateType: WizardTemplateType, count?: number) => WizardListDraft
  createWizardWidgetDraft: (name: string, type: WidgetType) => WizardWidgetDraft
  wizardDefaultSortDirection: (templateType: WizardTemplateType, field: string) => ListSortDirection
  wizardDefaultTemplates: WizardTemplateType[]
  wizardDeadlineApplicable: (templateType: WizardTemplateType) => boolean
  wizardSortDirectionOptions: (
    templateType: WizardTemplateType,
    field: string
  ) => Array<{ value: Exclude<ListSortDirection, 'manual'>; label: string }> | Array<{ value: ListSortDirection; label: string }>
  wizardSortOptions: (templateType: WizardTemplateType) => Array<{ value: string; label: string }>
  wizardSteps: (listDrafts: WizardListDraft[]) => WizardStepId[]
  wizardTemplateLabel: (templateType: WizardTemplateType) => string
  wizardTemplateOptions: Array<{ value: WizardTemplateType; label: string; description: string }>
  wizardWidgetLayoutOptions: Record<WidgetType, string[]>
  widgetTypes: Array<{ value: WidgetType; label: string }>
}

export function ConfigurationWizard({
  boards,
  busy,
  firstRun,
  helpers,
  logoSrc,
  onApply,
  onClose,
  onMarkComplete,
  onPrepareReset,
  setGlobalMessageDialog,
  snapshot
}: {
  boards: BoardSummary[]
  busy: boolean
  firstRun: boolean
  helpers: WizardHelpers
  logoSrc: string
  onApply: (data: WizardData) => Promise<BoardSnapshot | undefined>
  onClose: () => void
  onMarkComplete: (mode: WizardMode) => Promise<void>
  onPrepareReset: () => Promise<BoardSnapshot | undefined>
  setGlobalMessageDialog: Dispatch<SetStateAction<{ title: string; message: string } | null>>
  snapshot: BoardSnapshot
}): ReactElement {
  const [mode, setMode] = useState<WizardMode>(firstRun ? 'firstRun' : 'newBoard')
  const [targetBoardId, setTargetBoardId] = useState(() => boards.find((board) => board.active)?.id ?? snapshot.id)
  const [step, setStep] = useState<WizardStepId>(firstRun ? 'welcome' : 'mode')
  const [userName, setUserName] = useState('User')
  const [boardName, setBoardName] = useState('My Life Plan Lite')
  const [boardNameTouched, setBoardNameTouched] = useState(false)
  const [selectedTemplates, setSelectedTemplates] = useState<WizardTemplateType[]>(helpers.wizardDefaultTemplates)
  const [listDrafts, setListDrafts] = useState<WizardListDraft[]>(() => helpers.wizardDefaultTemplates.map((templateType) => helpers.createWizardListDraft(templateType)))
  const [useStoreList, setUseStoreList] = useState(false)
  const [storeText, setStoreText] = useState('')
  const [birthdayBoardView, setBirthdayBoardView] = useState<BirthdayBoardView>('next_30_days')
  const [widgets, setWidgets] = useState<WizardWidgetDraft[]>([])
  const [skipDialogOpen, setSkipDialogOpen] = useState(false)
  const [resetPrepared, setResetPrepared] = useState(false)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const steps = helpers.wizardSteps(listDrafts)
  const currentStepIndex = Math.max(0, steps.indexOf(step))
  const hasShopping = listDrafts.some((list) => list.templateType === 'shopping_list')
  const hasBirthdays = listDrafts.some((list) => list.templateType === 'birthday_calendar')

  function wizardData(): WizardData {
    return {
      mode,
      targetBoardId: mode === 'quickAdd' ? targetBoardId : null,
      userName: userName.trim() || 'User',
      boardName: boardName.trim() || 'My Life Plan Lite',
      listDrafts,
      useStoreList: hasShopping && useStoreList,
      storeText,
      birthdayBoardView,
      widgets
    }
  }

  function startWizardMode(nextMode: WizardMode): void {
    if (nextMode === 'reset') {
      setResetConfirmOpen(true)
      return
    }
    setMode(nextMode)
    setResetPrepared(false)
    if (nextMode === 'quickAdd') {
      setStep('templates')
      setBoardNameTouched(true)
      return
    }
    setStep('welcome')
    setBoardNameTouched(false)
    setBoardName(userName.trim() && userName.trim().toLowerCase() !== 'user' ? `${userName.trim()}'s Life Plan Lite` : 'My Life Plan Lite')
  }

  async function confirmResetMode(): Promise<void> {
    const result = await onPrepareReset()
    if (!result) return
    setResetConfirmOpen(false)
    setResetPrepared(true)
    setMode('reset')
    setStep('welcome')
    setBoardNameTouched(false)
    setBoardName('My Life Plan Lite')
  }

  function setUser(value: string): void {
    setUserName(value)
    if (!boardNameTouched) {
      const trimmed = value.trim()
      setBoardName(trimmed && trimmed.toLowerCase() !== 'user' ? `${trimmed}'s Life Plan Lite` : 'My Life Plan Lite')
    }
  }

  function toggleTemplate(templateType: WizardTemplateType): void {
    setSelectedTemplates((current) => {
      const selected = current.includes(templateType)
      const next = selected ? current.filter((value) => value !== templateType) : [...current, templateType]
      setListDrafts((drafts) => {
        if (selected) return drafts.filter((draft) => draft.templateType !== templateType)
        return [...drafts, helpers.createWizardListDraft(templateType)]
      })
      return next
    })
  }

  function updateListDraft(id: string, patch: Partial<WizardListDraft>): void {
    setListDrafts((current) => current.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)))
  }

  function addListDraft(templateType: WizardTemplateType): void {
    if (listDrafts.length >= 16) {
      setGlobalMessageDialog({ title: 'List limit reached', message: 'You can display a maximum of 16 lists on a single board.' })
      return
    }
    setListDrafts((current) => {
      const nextDraft = helpers.createWizardListDraft(templateType, current.filter((draft) => draft.templateType === templateType).length + 1)
      const lastMatchingIndex = [...current].reverse().findIndex((draft) => draft.templateType === templateType)
      if (lastMatchingIndex < 0) return [...current, nextDraft]
      const insertAt = current.length - lastMatchingIndex
      const next = [...current]
      next.splice(insertAt, 0, nextDraft)
      return next
    })
  }

  function updateWidgetDraft(id: string, patch: Partial<WizardWidgetDraft>): void {
    setWidgets((current) =>
      current.map((widget) => {
        if (widget.id !== id) return widget
        const type = patch.type ?? widget.type
        const layoutOptions = helpers.wizardWidgetLayoutOptions[type]
        const layout = patch.layout ?? (patch.type && !layoutOptions.includes(widget.layout) ? layoutOptions[0] : widget.layout)
        return { ...widget, ...patch, type, layout }
      })
    )
  }

  function addWidgetDraft(): void {
    setWidgets((current) => [...current, helpers.createWizardWidgetDraft('New Widget', 'clock')])
  }

  function deleteWidgetDraft(id: string): void {
    setWidgets((current) => current.filter((widget) => widget.id !== id))
  }

  function resetForAnotherBoard(): void {
    setMode('newBoard')
    setStep('welcome')
    setBoardNameTouched(false)
    setBoardName(userName.trim() && userName.trim().toLowerCase() !== 'user' ? `${userName.trim()}'s Life Plan Lite` : 'My Life Plan Lite')
  }

  async function finishWizard(): Promise<void> {
    setSkipDialogOpen(false)
    if (listDrafts.length === 0) {
      setGlobalMessageDialog({ title: 'Choose at least one list', message: 'Please select at least one list type before finishing the wizard.' })
      setStep('templates')
      return
    }
    const result = await onApply(wizardData())
    if (result) setStep('done')
  }

  function goNext(): void {
    if (step === 'templates' && selectedTemplates.length === 0) {
      setGlobalMessageDialog({ title: 'Choose at least one list', message: 'Please select at least one list type to include in your board.' })
      return
    }
    const nextStep = steps[currentStepIndex + 1]
    if (nextStep) setStep(nextStep)
  }

  function goBack(): void {
    const previousStep = steps[currentStepIndex - 1]
    if (previousStep) setStep(previousStep)
  }

  return (
    <div className="wizard-backdrop" role="presentation">
      <div aria-modal="true" className="wizard-card" role="dialog">
        <div className="wizard-body">
          <div className="wizard-brand-panel">
            <img alt="Life Plan Lite" className="wizard-logo" src={logoSrc} />
          </div>
          <div className="wizard-content">
            {step === 'mode' && (
              <section className="wizard-panel">
                <h2>What would you like the wizard to do?</h2>
                <p>Use the wizard to quickly add structure without going through each list tab manually.</p>
                <div className="wizard-mode-grid">
                  <button className="wizard-mode-card" onClick={() => startWizardMode('quickAdd')} type="button">
                    <strong>Quick-add lists</strong>
                    <small>Add several configured lists to an existing board.</small>
                    <select disabled={busy} onClick={(event) => event.stopPropagation()} onChange={(event) => setTargetBoardId(event.target.value)} value={targetBoardId}>
                      {boards.map((board) => (
                        <option key={board.id} value={board.id}>
                          {board.name}{board.active ? ' (active)' : ''}
                        </option>
                      ))}
                    </select>
                  </button>
                  <button className="wizard-mode-card" onClick={() => startWizardMode('newBoard')} type="button">
                    <strong>Create a new board</strong>
                    <small>Build a new board without touching existing boards or data.</small>
                  </button>
                  <button className="wizard-mode-card danger" onClick={() => startWizardMode('reset')} type="button">
                    <strong>Reset to first run</strong>
                    <small>Clear all boards and data after confirmation, then rebuild or leave the app empty.</small>
                  </button>
                </div>
              </section>
            )}

            {step === 'welcome' && (
              <section className="wizard-panel">
                <h2>{mode === 'firstRun' ? 'Hello and welcome to Life Plan Lite!' : mode === 'reset' ? 'Let’s rebuild Life Plan Lite!' : 'Let’s configure a new board!'}</h2>
                <p>
                  {mode === 'firstRun'
                    ? 'Let’s take a moment to configure your app! This quick setup tutorial will help you understand the key features and functionalities of LPL and guide you through the process of creating your first board.'
                    : mode === 'reset'
                      ? 'The app has already been cleared to first-run state. You can rebuild from the wizard now, close it and configure the board manually, or come back to the wizard later.'
                      : 'Let’s create another board using the same quick configuration flow. Existing boards and data will not be changed.'}
                </p>
                <p className="wizard-lead">Let&apos;s start with the basics:</p>
                <div className="wizard-form-grid">
                  <label>
                    <span>Who is using this board?</span>
                    <input disabled={busy} onChange={(event) => setUser(event.target.value)} value={userName} />
                  </label>
                  <label>
                    <span>How would you like the board to be called?</span>
                    <input
                      disabled={busy}
                      onChange={(event) => {
                        setBoardNameTouched(true)
                        setBoardName(event.target.value)
                      }}
                      value={boardName}
                    />
                  </label>
                </div>
              </section>
            )}

            {step === 'templates' && (
              <section className="wizard-panel">
                <h2>Let&apos;s chose the list types you plan to use!</h2>
                <p>Please select from the option below the types of lists you want to be included in your board:</p>
                <div className="wizard-template-grid">
                  {helpers.wizardTemplateOptions.map((option) => {
                    const selected = selectedTemplates.includes(option.value)
                    return (
                      <button className={selected ? 'wizard-template-card selected' : 'wizard-template-card'} key={option.value} onClick={() => toggleTemplate(option.value)} type="button">
                        <span className="wizard-check">{selected ? <Check size={13} /> : null}</span>
                        <span>
                          <strong>{option.label}</strong>
                          <small>{option.description}</small>
                        </span>
                      </button>
                    )
                  })}
                </div>
                <p className="wizard-note">You can always add more lists based on those templates at a later point, in the LPL Edit Menu</p>
              </section>
            )}

            {step === 'lists' && (
              <section className="wizard-panel">
                <h2>Let&apos;s define and name your lists!</h2>
                <p>You can choose to create one or more lists of each type by clicking the &quot;+&quot; next to the list.</p>
                <div className="wizard-table-scroll">
                  <div className="wizard-table two-col">
                    <strong>List Type</strong>
                    <strong>List Name</strong>
                    <span />
                    {listDrafts.map((draft, index) => {
                      const firstOfType = listDrafts.findIndex((candidate) => candidate.templateType === draft.templateType) === index
                      return (
                        <div className="wizard-table-row" key={draft.id}>
                          <input disabled readOnly value={helpers.wizardTemplateLabel(draft.templateType)} />
                          <input disabled={busy} onChange={(event) => updateListDraft(draft.id, { name: event.target.value })} value={draft.name} />
                          {firstOfType ? (
                            <button className="wizard-round-button" disabled={busy || listDrafts.length >= 16} onClick={() => addListDraft(draft.templateType)} title="Add another list of this type" type="button">
                              <Plus size={14} />
                            </button>
                          ) : (
                            <span />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
                <p className="wizard-note">Note: You can create as many lists as you like, but you can only have a maximum of 16 lists displayed at any time in a single board</p>
              </section>
            )}

            {step === 'specifics' && (
              <section className="wizard-panel">
                <h2>A couple list-specific settings...</h2>
                {hasShopping && (
                  <div className="wizard-question-block">
                    <p className="wizard-question">Do you want to define a list of stores to be used with the Shopping List?</p>
                    <p className="wizard-helper">Having this list defined doesn&apos;t force you to always add a store or to only use entries from this field. It just makes it easier to build some quick lists per store. You can always change this option later, in the Edit Panel - List Structure.</p>
                    <div className="wizard-radio-row">
                      <label className="wizard-radio">
                        <input checked={useStoreList} disabled={busy} onChange={() => setUseStoreList(true)} type="radio" />
                        <span>Yes</span>
                      </label>
                      <textarea disabled={busy || !useStoreList} onChange={(event) => setStoreText(event.target.value)} value={storeText} />
                      <label className="wizard-radio">
                        <input checked={!useStoreList} disabled={busy} onChange={() => setUseStoreList(false)} type="radio" />
                        <span>No, maybe later</span>
                      </label>
                    </div>
                    <p className="wizard-note compact">Please add one item per row</p>
                  </div>
                )}
                {hasBirthdays && (
                  <div className="wizard-question-block">
                    <p className="wizard-question">What interval do you want to use for upcoming birthdays?</p>
                    <select disabled={busy} onChange={(event) => setBirthdayBoardView(event.target.value as BirthdayBoardView)} value={birthdayBoardView}>
                      {helpers.birthdayBoardViewOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <p className="wizard-note compact">You can always change this option later, in the Edit Panel - List Structure</p>
                  </div>
                )}
              </section>
            )}

            {step === 'sorting' && (
              <section className="wizard-panel">
                <h2>Let&apos;s also define the sort order for you lists</h2>
                <p>Define the default ordering criteria for each list.</p>
                <div className="wizard-table-scroll">
                  <div className="wizard-table three-col">
                    <strong>List Name</strong>
                    <strong>Sort by</strong>
                    <strong>Sorting Order</strong>
                    {listDrafts.map((draft) => {
                      const options = helpers.wizardSortOptions(draft.templateType)
                      const birthdayLocked = draft.templateType === 'birthday_calendar'
                      return (
                        <div className="wizard-table-row" key={draft.id}>
                          <input disabled readOnly value={draft.name} />
                          <select disabled={busy || birthdayLocked} onChange={(event) => updateListDraft(draft.id, { sortField: event.target.value, sortDirection: helpers.wizardDefaultSortDirection(draft.templateType, event.target.value) })} value={draft.sortField}>
                            {options.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <select disabled={busy || birthdayLocked || draft.sortField === 'manual'} onChange={(event) => updateListDraft(draft.id, { sortDirection: event.target.value as ListSortDirection })} value={draft.sortDirection}>
                            {helpers.wizardSortDirectionOptions(draft.templateType, draft.sortField).map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <p className="wizard-note">You can always change this options later, in the Edit Panel - List Structure</p>
              </section>
            )}

            {step === 'finalTouches' && (
              <section className="wizard-panel">
                <h2>Almost there, a couple of final touches!</h2>
                <p>Please select which of the defined lists you want displayed in the board, for which we should enable the “deadline” field and whether this field should be mandatory</p>
                <div className="wizard-table-scroll">
                  <div className="wizard-table final-col">
                    {listDrafts.map((draft) => {
                      const deadlineEnabled = helpers.wizardDeadlineApplicable(draft.templateType)
                      return (
                        <div className="wizard-table-row" key={draft.id}>
                          <input disabled readOnly value={draft.name} />
                          <label className="wizard-inline-check">
                            <input checked={draft.displayEnabled} disabled={busy} onChange={(event) => updateListDraft(draft.id, { displayEnabled: event.target.checked })} type="checkbox" />
                            <span>Show</span>
                          </label>
                          {deadlineEnabled ? (
                            <label className="wizard-inline-check">
                              <input checked={draft.dueDateEnabled} disabled={busy} onChange={(event) => updateListDraft(draft.id, { dueDateEnabled: event.target.checked, deadlineMandatory: event.target.checked ? draft.deadlineMandatory : false })} type="checkbox" />
                              <span>Deadline Enabled</span>
                            </label>
                          ) : (
                            <span className="wizard-na">n/a</span>
                          )}
                          {deadlineEnabled ? (
                            <label className="wizard-inline-check">
                              <input checked={draft.deadlineMandatory} disabled={busy || !draft.dueDateEnabled} onChange={(event) => updateListDraft(draft.id, { deadlineMandatory: event.target.checked })} type="checkbox" />
                              <span>Deadline Mandatory</span>
                            </label>
                          ) : (
                            <span className="wizard-na">n/a</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
                <p className="wizard-note">Note: the deadline field for the shopping list is labeled as “Needed by” but it shares the same functionality as other deadline fields.</p>
              </section>
            )}

            {step === 'widgets' && (
              <section className="wizard-panel">
                <h2>Widgets! They&apos;re Here!</h2>
                <p>Want to spruce-up your boards? Add some widgets!</p>
                <button className="wizard-add-button" disabled={busy} onClick={addWidgetDraft} type="button">Add Widget</button>
                <p className="wizard-lead">Widgets in you Board:</p>
                {widgets.length > 0 ? (
                  <div className="wizard-table widget-col">
                    <strong>Name</strong>
                    <strong>Type</strong>
                    <strong>Layout</strong>
                    <strong>Show</strong>
                    <span />
                    {widgets.map((widget) => (
                      <div className="wizard-table-row" key={widget.id}>
                        <input disabled={busy} onChange={(event) => updateWidgetDraft(widget.id, { name: event.target.value })} value={widget.name} />
                        <select disabled={busy} onChange={(event) => updateWidgetDraft(widget.id, { type: event.target.value as WidgetType })} value={widget.type}>
                          {helpers.widgetTypes.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                        <select disabled={busy} onChange={(event) => updateWidgetDraft(widget.id, { layout: event.target.value })} value={widget.layout}>
                          {helpers.wizardWidgetLayoutOptions[widget.type].map((layout) => (
                            <option key={layout} value={layout}>
                              {layout}
                            </option>
                          ))}
                        </select>
                        <label className="wizard-inline-check">
                          <input checked={widget.displayEnabled} disabled={busy} onChange={(event) => updateWidgetDraft(widget.id, { displayEnabled: event.target.checked })} type="checkbox" />
                          <span>Show</span>
                        </label>
                        <button className="wizard-round-button danger" disabled={busy} onClick={() => deleteWidgetDraft(widget.id)} title="Delete widget" type="button">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="wizard-note">No widgets selected yet. Use Add Widget if you want to include one on this board.</p>
                )}
              </section>
            )}

            {step === 'done' && (
              <section className="wizard-panel">
                <h2>We&apos;re all done!</h2>
                <p>
                  Congratulations, your first board in configured and saved!<br />
                  You can now start using your board and building a <strong>Life <span>Plan</span> Lite!</strong>
                </p>
                <p>Remember, you can always run this wizard again to build new boards, or even to completely reset your LPL to first run state cleaning all the boards and data.</p>
                <div className="wizard-done-actions">
                  <p>Before closing, do you want to create one more board now?</p>
                  <button className="icon-button" disabled={busy} onClick={resetForAnotherBoard} type="button">Let&apos;s build one more board</button>
                  <button className="primary-button" disabled={busy} onClick={onClose} type="button">Let&apos;s get Life <span>Planning!</span></button>
                </div>
              </section>
            )}
          </div>
        </div>
        {step === 'mode' && (
          <footer className="wizard-footer single">
            <button className="wizard-skip" disabled={busy} onClick={onClose} type="button">Close Wizard</button>
          </footer>
        )}
        {step !== 'done' && step !== 'mode' && (
          <footer className="wizard-footer">
            <div className="wizard-footer-left">
              {mode === 'reset' && resetPrepared && step === 'welcome' ? (
                <button className="icon-button wizard-back" disabled={busy} onClick={() => void onMarkComplete(mode)} type="button">Close Wizard</button>
              ) : currentStepIndex > 0 ? (
                <button className="wizard-back" disabled={busy} onClick={goBack} type="button">Back</button>
              ) : (
                <span />
              )}
            </div>
            <div className="wizard-footer-right">
              <button className="wizard-skip" disabled={busy} onClick={() => setSkipDialogOpen(true)} type="button">Skip Configuration Wizard</button>
              {step === 'widgets' ? (
                <button className="primary-button wizard-next" disabled={busy} onClick={() => void finishWizard()} type="button">Finish</button>
              ) : (
                <button className="primary-button wizard-next" disabled={busy} onClick={goNext} type="button">Next</button>
              )}
            </div>
          </footer>
        )}
      </div>
      {skipDialogOpen && (
        <div className="modal-backdrop nested" onClick={() => setSkipDialogOpen(false)} role="presentation">
          <div aria-modal="true" className="modal-card message-modal" onClick={(event) => event.stopPropagation()} role="dialog">
            <div className="modal-header">
              <div>
                <p className="eyebrow">Wizard</p>
                <h3>Close Configuration Wizard?</h3>
              </div>
            </div>
            <div className="modal-body">
              <p>
                {mode === 'reset' && resetPrepared
                  ? 'The reset has already been applied. You can finish rebuilding now, or close the wizard and leave the app empty for manual setup later.'
                  : 'You can apply the information entered so far and create the board now, or close the wizard without applying anything.'}
              </p>
            </div>
            <div className="modal-actions">
              <button className="icon-button" disabled={busy} onClick={() => setSkipDialogOpen(false)} type="button">Continue Wizard</button>
              <button className="icon-button" disabled={busy} onClick={() => void onMarkComplete(mode)} type="button">
                {mode === 'reset' && resetPrepared ? 'Close Wizard' : 'Close Without Applying'}
              </button>
              <button className="primary-button" disabled={busy} onClick={() => void finishWizard()} type="button">Apply Current Setup</button>
            </div>
          </div>
        </div>
      )}
      {resetConfirmOpen && (
        <ConfirmActionModal
          busy={busy}
          confirmLabel="Reset App"
          destructive
          message="This will permanently delete all existing boards, lists, items, widgets, archive entries, and app settings. The app will then return to an empty first-run state. Continue?"
          onCancel={() => setResetConfirmOpen(false)}
          onConfirm={() => void confirmResetMode()}
          title="Reset Life Plan Lite?"
        />
      )}
    </div>
  )
}
