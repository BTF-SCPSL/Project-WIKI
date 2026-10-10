import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import {
  isEditorRole, pkceChallenge, makeAssertion, verifyAssertion, canonicalOrigin,
  escapeHtml, parseCookies,
} from '../helpers.mjs';

test('exact BTF role keys, not display names or IsRoot', () => {
  assert.equal(isEditorRole('owner'), true);
  assert.equal(isEditorRole('project_lead'), true);
  for (const value of ['player', 'admin', 'moderator', 'Owner', 'Владелец', '__proto__', '', null]) {
    assert.equal(isEditorRole(value), false);
  }
});

test('PKCE S256 is standard-compliant', () => {
  assert.equal(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'),
    'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
});

test('internal bridge assertions expire and cannot be forged', () => {
  const secret = randomBytes(32).toString('hex');
  const user = { sub: '12345', name: 'BTF Owner', role: 'owner' };
  const value = makeAssertion(user, secret, 100000);
  assert.equal(verifyAssertion(value, secret, 100001)?.role, 'owner');
  assert.equal(verifyAssertion(value, secret, 116000), null);
  assert.equal(verifyAssertion(value, 'invalid-secret', 100001), null);
  const [data] = value.split('.');
  assert.equal(verifyAssertion(data + '.bad', secret, 100001), null);
  assert.equal(verifyAssertion(makeAssertion({ ...user, role: 'player' }, secret, 100000), secret, 100001), null);
});

test('cookie parsing and escaped names', () => {
  assert.equal(parseCookies('other=1; session=ABC').get('session'), 'ABC');
  assert.equal(escapeHtml('<script>"'), '&lt;script&gt;&quot;');
});

test('public origin policy rejects injected paths and insecure remote hosts', () => {
  assert.equal(canonicalOrigin('https://editor.example.com/'), 'https://editor.example.com');
  assert.equal(canonicalOrigin('http://localhost:3000/'), 'http://localhost:3000');
  assert.throws(() => canonicalOrigin('http://editor.example.com/'));
  assert.throws(() => canonicalOrigin('https://editor.example.com/callback'));
});
