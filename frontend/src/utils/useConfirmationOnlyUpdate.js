import { useLayoutEffect, useRef } from 'react';

export const confirmationUpdateSignature = (state) => {
  const header = { ...state.header };
  delete header.confirmed;
  delete header.Confirmed;
  return JSON.stringify({ ...state, header });
};

// A full state comparison prevents confirmation-only mode from silently
// discarding edits made through modals, line operations or programmatic actions.
export default function useConfirmationOnlyUpdate({ docEntry, isDirty, state }) {
  const saved = useRef(null);
  const scope = JSON.stringify([docEntry, state.company_id, state.companyDb, state.companyKey]);
  const signature = confirmationUpdateSignature(state);
  useLayoutEffect(() => {
    if (!docEntry) saved.current = null;
    else if (!isDirty) saved.current = { scope, signature, confirmed: state.header?.confirmed };
  }, [docEntry, isDirty, scope, signature, state.header?.confirmed]);

  return (payload) => {
    const baseline = saved.current;
    const confirmed = state.header?.confirmed;
    if (docEntry && baseline?.scope === scope && baseline.signature === signature
      && typeof confirmed === 'boolean' && baseline.confirmed !== confirmed) {
      return { company_id: payload.company_id, confirmation_only: true, header: { confirmed } };
    }
    return payload;
  };
}
