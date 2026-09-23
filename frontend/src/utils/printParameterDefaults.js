const hasConfiguredValue = (value) => (
  value !== undefined
  && value !== null
  && String(value).trim() !== ''
);

const getOptionValue = (option) => (
  option && typeof option === 'object'
    ? (option.value ?? option.label ?? '')
    : (option ?? '')
);

export const resolvePrintParameterDefaultValue = (parameter = {}) => {
  if (hasConfiguredValue(parameter.defaultValue)) return parameter.defaultValue;
  if (hasConfiguredValue(parameter.value)) return parameter.value;

  const firstOption = Array.isArray(parameter.options)
    ? parameter.options.find((option) => hasConfiguredValue(getOptionValue(option)))
    : null;
  return firstOption == null ? '' : getOptionValue(firstOption);
};

export const buildDefaultReportParameterPayload = (parameters = []) => (
  (parameters || [])
    .filter((parameter) => String(parameter?.paramName || '').trim())
    .map((parameter) => ({
      name: parameter.paramName,
      type: parameter.paramType,
      value: resolvePrintParameterDefaultValue(parameter),
    }))
);
