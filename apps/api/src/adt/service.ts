import { randomUUID } from 'node:crypto';
import { reference, type Encounter, type EncounterLocation } from '@osemr/fhir-model';
import type { EncounterRepository } from '../encounters/repository';
import { AdtError } from './errors';

// HL7 v3 ActCode system for Encounter.class (IMP = inpatient encounter).
const ACT_ENCOUNTER_CLASS = 'http://terminology.hl7.org/CodeSystem/v3-ActCode';
const DISCHARGE_DISPOSITION = 'http://terminology.hl7.org/CodeSystem/discharge-disposition';

export interface AdmitCommand {
  patientId: string;
  /** Identifier of the destination location (bed/unit). */
  location: string;
  /** Encounter class code; defaults to IMP (inpatient). */
  classCode?: string;
}

export interface TransferCommand {
  toLocation: string;
}

export interface DischargeCommand {
  /** Discharge disposition code (e.g. 'home', 'snf', 'exp'). Optional. */
  disposition?: string;
}

/** Pluggable clock so tests get deterministic timestamps. */
export type Clock = () => string;

/**
 * Drives the inpatient encounter lifecycle (the "ADT" state machine):
 *
 *   admit ──▶ in-progress ──transfer──▶ in-progress ──discharge──▶ finished
 *                  │
 *                  └────────────cancel──────────────▶ cancelled
 *
 * Encounters are stored as FHIR Encounter resources; this service applies valid
 * state transitions to them and rejects invalid ones (e.g. transferring an
 * already-discharged patient).
 */
export class AdtService {
  constructor(
    private readonly encounters: EncounterRepository,
    private readonly now: Clock = () => new Date().toISOString(),
  ) {}

  /** Admit a patient: create a new in-progress inpatient encounter. */
  async admit(cmd: AdmitCommand): Promise<Encounter> {
    if (!cmd.patientId || !cmd.location) {
      throw new AdtError('invalid', 'admit requires patientId and location');
    }
    const ts = this.now();
    const encounter: Encounter = {
      resourceType: 'Encounter',
      id: randomUUID(),
      status: 'in-progress',
      class: {
        system: ACT_ENCOUNTER_CLASS,
        code: cmd.classCode ?? 'IMP',
        display: 'inpatient encounter',
      },
      subject: reference('Patient', cmd.patientId),
      period: { start: ts },
      location: [openLocation(cmd.location, ts)],
    };
    return this.encounters.save(encounter);
  }

  /** Transfer to a new location: close the current bed, open the next one. */
  async transfer(encounterId: string, cmd: TransferCommand): Promise<Encounter> {
    if (!cmd.toLocation) {
      throw new AdtError('invalid', 'transfer requires toLocation');
    }
    const encounter = await this.requireInProgress(encounterId);
    const ts = this.now();
    const location = closeActiveLocations(encounter.location, ts);
    location.push(openLocation(cmd.toLocation, ts));
    return this.encounters.save({ ...encounter, location });
  }

  /** Discharge: end the encounter, close the active bed, record disposition. */
  async discharge(encounterId: string, cmd: DischargeCommand): Promise<Encounter> {
    const encounter = await this.requireInProgress(encounterId);
    const ts = this.now();
    const discharged: Encounter = {
      ...encounter,
      status: 'finished',
      period: { ...encounter.period, end: ts },
      location: closeActiveLocations(encounter.location, ts),
    };
    if (cmd.disposition) {
      discharged.hospitalization = {
        dischargeDisposition: {
          coding: [{ system: DISCHARGE_DISPOSITION, code: cmd.disposition }],
          text: cmd.disposition,
        },
      };
    }
    return this.encounters.save(discharged);
  }

  /** Cancel an admission (data-entry error / never-arrived). */
  async cancel(encounterId: string): Promise<Encounter> {
    const encounter = await this.require(encounterId);
    if (encounter.status === 'finished') {
      throw new AdtError('invalid-transition', 'Cannot cancel a finished encounter');
    }
    return this.encounters.save({ ...encounter, status: 'cancelled' });
  }

  private async require(id: string): Promise<Encounter> {
    const encounter = await this.encounters.findById(id);
    if (!encounter) {
      throw new AdtError('not-found', `Encounter/${id} not found`);
    }
    return encounter;
  }

  private async requireInProgress(id: string): Promise<Encounter> {
    const encounter = await this.require(id);
    if (encounter.status !== 'in-progress') {
      throw new AdtError(
        'invalid-transition',
        `Encounter/${id} is '${encounter.status}', but this action requires 'in-progress'`,
      );
    }
    return encounter;
  }
}

function openLocation(locationId: string, start: string): EncounterLocation {
  return { location: reference('Location', locationId), status: 'active', period: { start } };
}

function closeActiveLocations(
  locations: EncounterLocation[] | undefined,
  end: string,
): EncounterLocation[] {
  return (locations ?? []).map((loc) =>
    loc.status === 'active' ? { ...loc, status: 'completed', period: { ...loc.period, end } } : loc,
  );
}
