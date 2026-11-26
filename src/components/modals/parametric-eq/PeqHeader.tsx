import React from 'react';
import type { Translations } from '../../../i18n';
import { Sliders, RotateCcw, Upload } from '../../ui/icons';
import { type ParametricEqStateDto } from '../../../utils/parametricEqMath';
import type { ParametricEqModalProps } from '../ParametricEqModal';
import type { Dispatch, SetStateAction } from 'react';
import { Badge, Button, ModalHeader } from '../../ui';
import { ToggleSwitch } from '../../common/ToggleSwitch';

export type PeqHeaderProps = Pick<ParametricEqModalProps, 'onClose'> & {
  state: ParametricEqStateDto;
  loc: Translations;
  handleToggleEnabled: () => void;
  handleResetFlat: () => void;
  setIsImportModalOpen: Dispatch<SetStateAction<boolean>>;
};

export const PeqHeader: React.FC<PeqHeaderProps> = ({
  handleResetFlat,
  handleToggleEnabled,
  loc,
  onClose,
  setIsImportModalOpen,
  state,
}) => (
  <ModalHeader
    titleId="peq-title"
    title="Parametric EQ Studio"
    subtitle={loc.parametricEq.subtitle}
    icon={<Sliders size={20} />}
    tone="cyan"
    onClose={onClose}
    closeLabel={loc.common.close}
    actions={
      <>
        {/* On / Bypass: the badge is the visible state, the switch names the action */}
        <Badge tone={state.enabled ? 'green' : 'neutral'} className="uppercase">
          {state.enabled ? loc.parametricEq.enabled : loc.parametricEq.bypass}
        </Badge>
        <ToggleSwitch checked={state.enabled} onChange={handleToggleEnabled} label={loc.parametricEq.enabled} />
        <Button size="sm" onClick={handleResetFlat} title={loc.parametricEq.resetAllBands}>
          <RotateCcw size={13} /> Reset Flat
        </Button>
        <Button variant="tinted" tone="cyan" size="sm" onClick={() => setIsImportModalOpen(true)}>
          <Upload size={13} /> Import / Export
        </Button>
      </>
    }
  />
);
