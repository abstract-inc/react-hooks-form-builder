import { set, get } from "lodash";
import React, {
  createContext,
  FormEvent,
  Props,
  Reducer,
  useContext,
  useReducer,
  ReactNode,
  useEffect
} from "react";

interface FormBuiderState<TState = { [property: string]: any }> {
  errors: { [property: string]: string };
  fieldsValues: TState;
  loadingInitialData: boolean;
}

interface ChildrenParams extends FormBuilderProps {
  state: FormBuiderState<any>;
}

interface FormBuilderProps<T = any> extends Props<T> {
  FormLoader: ReactNode;
  onSubmit: (ev: React.FormEvent<HTMLFormElement>, values: any) => any;
  initialFieldValuesLoader?: (props: FormBuilderProps<T>) => Promise<any>;
  children: (params: ChildrenParams) => React.ReactNode;
  FormElement?: React.ReactNode;
}

export enum FormBuilderActions {
  ON_STATE_CHANGE = "ON_STATE_CHANGE",
  ON_ERRORS_CHANGE = "ON_ERRORS_CHANGE",
  ON_FIELD_VALUE_CHANGE = "ON_FIELD_VALUE_CHANGE"
}

const initialState: FormBuiderState = {
  fieldsValues: {},
  errors: {},
  loadingInitialData: false
};

interface FormBuilderActionMapType<TPayload = any> {
  type: keyof typeof FormBuilderActions;
  payload: TPayload;
}
const actionsMap: {
  [property: string]: (
    state: FormBuiderState,
    nextValue: any
  ) => FormBuiderState;
} = {
  [FormBuilderActions.ON_STATE_CHANGE]: (
    state: FormBuiderState,
    nextValue: any
  ) => ({ ...state, ...nextValue }),
  [FormBuilderActions.ON_ERRORS_CHANGE]: (
    state: FormBuiderState,
    data: { name: string; value: any }
  ) => ({ ...state, errors: { ...state.errors, [data.name]: data.value } }),
  [FormBuilderActions.ON_FIELD_VALUE_CHANGE]: (
    state: FormBuiderState,
    data: { name: string; value: any }
  ) => ({
    ...state,
    fieldsValues: {
      ...state.fieldsValues,
      ...set({ ...state.fieldsValues }, data.name, data.value)
    }
  })
};

interface FormBuilderContextType {
  state: FormBuiderState;
  dispatch(action: FormBuilderActionMapType): void;
  onFieldChange<TValue = any>(fieldName: string, value: TValue): any;
}

const defaultContext: FormBuilderContextType = {
  state: {
    errors: {},
    fieldsValues: {},
    loadingInitialData: false
  },
  onFieldChange() {},
  dispatch() {}
};
const FormBuilderContext = createContext<FormBuilderContextType>(
  defaultContext
);

interface FormBuildreChildrenParams<T = any> extends FormBuilderContextType {
  fieldError: string;
  value: T;
  onChange: (value: T) => void;
}

const reducer = (
  state: FormBuiderState = initialState,
  action: FormBuilderActionMapType
): FormBuiderState => {
  if (!(action.type in actionsMap)) {
    console.log(`ACTION [${action.type}] NOT FOUND IN actionsMap`, actionsMap);
    return state;
  }

  return actionsMap[action.type](state, action.payload);
};

function DefaultFormElement(props: any) {
  return <form {...props} />;
}

export default function FormBuilder(props: FormBuilderProps) {
  const { onSubmit, initialFieldValuesLoader, FormLoader } = props;

  const [state, dispatch] = useReducer<
    Reducer<FormBuiderState, FormBuilderActionMapType>
  >(reducer, initialState);

  function onFieldChange<TValue = any>(fieldName: string, value: TValue) {
    dispatch({
      type: FormBuilderActions.ON_FIELD_VALUE_CHANGE,
      payload: {
        name: fieldName,
        value
      }
    });
  }
  async function loadInitialData() {
    if (initialFieldValuesLoader) {
      dispatch({
        type: FormBuilderActions.ON_STATE_CHANGE,
        payload: {
          loadingInitialData: true
        }
      });

      const fieldsValues = await initialFieldValuesLoader(props);
      setTimeout(
        () =>
          dispatch({
            type: FormBuilderActions.ON_STATE_CHANGE,
            payload: {
              fieldsValues,
              loadingInitialData: false
            }
          }),
        3 * 1000
      );
    }
  }
  useEffect(() => {
    loadInitialData();
  }, []);

  const providerValue = {
    ...defaultContext,
    state,
    dispatch,
    onFieldChange
  };
  const Form: any = props.FormElement || DefaultFormElement;
  return (
    <FormBuilderContext.Provider value={providerValue}>
      {state.loadingInitialData && FormLoader}
      {!state.loadingInitialData && (
        <Form
          onSubmit={(event: FormEvent<any>) => {
            event.persist();
            event.preventDefault();
            const formElement = event.target || document.createElement("form");
            //@ts-ignore
            const form = new FormData(formElement);
            let values = {};
            for (let [key, value] of form) {
              set(values, key, value);
            }
            onSubmit(event, values);
          }}
        >
          {props.children
            ? props.children({ ...props, ...providerValue })
            : null}
        </Form>
      )}
    </FormBuilderContext.Provider>
  );
}

export function FormBuilderField(props: {
  fieldName: string;
  children: (params: FormBuildreChildrenParams) => React.ReactNode;
}) {
  const { children, fieldName } = props;
  return (
    <FormBuilderContext.Consumer>
      {({ dispatch, state, onFieldChange }) =>
        children
          ? children({
              fieldError: state.errors[fieldName],
              value: get(state.fieldsValues, fieldName),
              dispatch,
              onFieldChange,
              state,
              onChange: value => {
                onFieldChange(fieldName, value);
              }
            })
          : null
      }
    </FormBuilderContext.Consumer>
  );
}

export function useFormBuilderField<TValue = any>(
  fieldName: string,
  defaultValue: TValue,
  validator?: (value: TValue) => string | boolean
): FormBuildreChildrenParams<TValue> {
  const { dispatch, state, onFieldChange } = useContext(FormBuilderContext);
  return {
    fieldError: state.errors[fieldName],
    value: get(state.fieldsValues, fieldName) || defaultValue,
    dispatch,
    onFieldChange,
    state,
    onChange: (value: TValue) => {
      if (validator) {
        const error = validator(value);
        if (error) {
          dispatch({
            type: FormBuilderActions.ON_ERRORS_CHANGE,
            payload: {
              name: fieldName,
              value: error
            }
          });
        } else {
          dispatch({
            type: FormBuilderActions.ON_ERRORS_CHANGE,
            payload: {
              name: fieldName,
              value: false
            }
          });
        }
      }
      onFieldChange(fieldName, value);
    }
  };
}
