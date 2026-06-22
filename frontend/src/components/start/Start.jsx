//  Start — the source-first entry. Shown by the config index when the first interface has no
//  sources yet: describe a source → choose inFlow/inChat → the workspace powers up on that source.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { useConfig } from '../../state/ConfigContext.jsx';
import { useViewMode } from '../../state/ViewModeContext.jsx';
import { upsertSource } from '../../models/configModel.js';
import { setColumns } from '../../lib/columnStore.js';
import SourceLoader from './SourceLoader.jsx';
import EntryOverlay from './EntryOverlay.jsx';

export default function Start({ configId }) {
  const { model, updateModel, updateInterface } = useConfig();
  const { setViewMode } = useViewMode();
  const router = useRouter();
  const [step, setStep] = useState('source');
  const [pending, setPending] = useState(null); // { source, columns }

  const interfaceName = model?.interfaceOrder?.[0] ?? 'interface_1';

  const onSource = (source, columns) => {
    setPending({ source, columns });
    setStep('entry');
  };

  const onChoose = (view) => {
    const { source, columns } = pending;
    updateModel((m) => upsertSource(m, source));
    updateInterface(interfaceName, (it) => ({ ...it, sources: [...(it.sources ?? []), source.id] }));
    setColumns(source.id, columns);
    setViewMode(view);
    router.push(`/configs/${configId}/interfaces/${interfaceName}`);
  };

  return (
    <div className="start">
      <div className="start__brandline">
        <span className="start__step">{step === 'source' ? 'Step 1 · Choose your data' : 'Step 2 · Choose your tool'}</span>
        <h1 className="start__title">{step === 'source' ? 'Start with a data source' : `Build ${pending?.source?.id ?? 'your pipeline'}`}</h1>
      </div>
      {step === 'source'
        ? <SourceLoader existingIds={model?.sourceOrder ?? []} onSubmit={onSource} />
        : <EntryOverlay onChoose={onChoose} onBack={() => setStep('source')} />}
    </div>
  );
}
