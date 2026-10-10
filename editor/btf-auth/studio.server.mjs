import { verifyAssertion } from './helpers.mjs';

// Fail closed even if someone bypasses the gateway and reaches Studio locally.
// The gateway overwrites this header after validating the BTF OIDC session.
export default {
  authenticate: ({ request }) => {
    const identity = verifyAssertion(
      request.headers['x-btf-editor-assertion'],
      process.env.BTF_EDITOR_BRIDGE_SECRET,
    );
    if (!identity) return null;
    return { user: { name: identity.name }, read: true, write: true };
  },
};
