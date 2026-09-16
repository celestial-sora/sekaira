import test from 'node:test';
import assert from 'node:assert/strict';
import {WorldForm,PersonaForm} from '../src/components/forms';
import {ScenarioForm} from '../src/components/scenario-form';

test('scenario and persona forms stay available from the app form module',()=>{
 assert.equal(typeof WorldForm,'function');
 assert.equal(typeof PersonaForm,'function');
 assert.equal(typeof ScenarioForm,'function');
});
