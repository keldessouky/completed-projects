import { Component, type ErrorInfo, type ReactNode } from 'react';

// One broken widget shouldn't take down the whole bridge. An *error boundary*
// catches errors thrown while rendering its children, and shows a fallback.
// (Error boundaries must be class components — React has no hook for this yet.)
//
//   <ErrorBoundary fallback={(error, reset) => <button onClick={reset}>Retry</button>}>
//     <Widget />
//   </ErrorBoundary>
//
//   - render children normally while there is no error
//   - after a child throws, render fallback(error, reset)
//   - reset() clears the error, so the children render again
//   - call onError(error) (if given) once for each error caught

type Props = {
  fallback: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error) => void;
  children: ReactNode;
};

export class ErrorBoundary extends Component<Props> {
  render() {
    return this.props.children;
  }
}
