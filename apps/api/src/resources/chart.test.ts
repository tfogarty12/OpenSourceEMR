import { describe, it, expect, afterAll } from 'vitest';
import { buildApp } from '../app';
import { bearer, testDependencies } from '../test-support/auth';

const app = buildApp({}, testDependencies());
const physician = { authorization: bearer(['physician']) };

afterAll(async () => {
  await app.close();
});

const PT = 'Patient/chart-pt';

function create(headers: Record<string, string>, body: Record<string, unknown>) {
  return app.inject({
    method: 'POST',
    url: `/fhir/${body['resourceType']}`,
    headers,
    payload: body,
  });
}

describe('clinical chart resources', () => {
  it('records and finds a problem, allergy, observation, and medication by patient', async () => {
    const resources = [
      { resourceType: 'Condition', subject: { reference: PT }, code: { text: 'Hypertension' } },
      {
        resourceType: 'AllergyIntolerance',
        patient: { reference: PT },
        code: { text: 'Penicillin' },
      },
      {
        resourceType: 'Observation',
        status: 'final',
        subject: { reference: PT },
        code: { text: 'Systolic BP' },
        valueQuantity: {
          value: 128,
          unit: 'mmHg',
          system: 'http://unitsofmeasure.org',
          code: 'mm[Hg]',
        },
      },
      {
        resourceType: 'MedicationStatement',
        status: 'active',
        subject: { reference: PT },
        medicationCodeableConcept: { text: 'Lisinopril 10mg' },
      },
    ];

    for (const resource of resources) {
      const res = await create(physician, resource);
      expect(res.statusCode).toBe(201);
      expect(res.json().meta.versionId).toBe('1');
    }

    for (const type of ['Condition', 'AllergyIntolerance', 'Observation', 'MedicationStatement']) {
      const search = await app.inject({
        method: 'GET',
        url: `/fhir/${type}?patient=chart-pt`,
        headers: physician,
      });
      expect(search.statusCode).toBe(200);
      expect(search.json().total).toBe(1);
    }
  });

  it('filters observations by status', async () => {
    await create(physician, {
      resourceType: 'Observation',
      status: 'preliminary',
      subject: { reference: 'Patient/obs-pt' },
      code: { text: 'Temp' },
    });
    const res = await app.inject({
      method: 'GET',
      url: '/fhir/Observation?patient=obs-pt&status=preliminary',
      headers: physician,
    });
    expect(res.json().total).toBe(1);
    const none = await app.inject({
      method: 'GET',
      url: '/fhir/Observation?patient=obs-pt&status=final',
      headers: physician,
    });
    expect(none.json().total).toBe(0);
  });

  describe('RBAC on the chart', () => {
    it('lets a nurse chart an Observation but not a Condition', async () => {
      const nurse = { authorization: bearer(['nurse']) };
      const obs = await create(nurse, {
        resourceType: 'Observation',
        status: 'final',
        subject: { reference: 'Patient/n1' },
        code: { text: 'HR' },
      });
      expect(obs.statusCode).toBe(201);

      const cond = await create(nurse, {
        resourceType: 'Condition',
        subject: { reference: 'Patient/n1' },
        code: { text: 'Asthma' },
      });
      expect(cond.statusCode).toBe(403);
    });

    it('lets the patient role read but not write the chart', async () => {
      const asPatient = { authorization: bearer(['patient']) };
      const read = await app.inject({
        method: 'GET',
        url: '/fhir/Condition?patient=chart-pt',
        headers: asPatient,
      });
      expect(read.statusCode).toBe(200);

      const write = await create(asPatient, {
        resourceType: 'Condition',
        subject: { reference: 'Patient/x' },
      });
      expect(write.statusCode).toBe(403);
    });
  });
});
