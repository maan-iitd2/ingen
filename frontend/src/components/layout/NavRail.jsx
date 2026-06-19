//  InGen Studio — NavRail (sidebar navigation)
//
//  Left rail for a config workspace. The interface list is driven by model.interfaceOrder (order is
//  YAML-significant). Sources / Run / History are live (Phases 2–3); Overview (multi-interface DAG)
//  remains a disabled marker reserved for the future React Flow view.

import { NavLink } from 'react-router-dom';
import { useConfig } from '../../state/ConfigContext.jsx';

const linkClass = ({ isActive }) => `navrail__link${isActive ? ' navrail__link--active' : ''}`;

export default function NavRail({ configId }) {
  const { model } = useConfig();
  const interfaces = model?.interfaceOrder ?? [];
  const base = `/configs/${configId}`;

  return (
    <nav className="navrail" aria-label="Config navigation">
      <div className="navrail__item navrail__item--disabled" title="Overview — multi-interface DAG (Phase 4)">
        <span>Overview</span><span className="navrail__soon">soon</span>
      </div>
      <NavLink to={`${base}/sources`} className={linkClass}>Sources</NavLink>

      <div className="navrail__section">
        <div className="navrail__heading">Interfaces</div>
        <ul className="navrail__list">
          {interfaces.map((name) => (
            <li key={name}>
              <NavLink to={`${base}/interfaces/${name}`} className={linkClass}>
                <span className="navrail__dot" aria-hidden="true" />
                {name}
              </NavLink>
            </li>
          ))}
          {interfaces.length === 0 && <li className="navrail__empty">No interfaces</li>}
        </ul>
      </div>

      <NavLink to={`${base}/run`} className={linkClass}>Run console</NavLink>
      <NavLink to={`${base}/history`} className={linkClass}>History</NavLink>
    </nav>
  );
}
