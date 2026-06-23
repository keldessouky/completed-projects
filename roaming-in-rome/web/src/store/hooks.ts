import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from './index';

/** Typed wrappers so components don't re-annotate dispatch/state everywhere. */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
