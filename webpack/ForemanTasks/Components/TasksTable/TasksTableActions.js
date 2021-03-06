import { getURIQuery } from 'foremanReact/common/helpers';
import { getTableItemsAction } from 'foremanReact/components/common/table';
import API from 'foremanReact/API';
import { addToast } from 'foremanReact/redux/actions/toasts';
import { translate as __, sprintf } from 'foremanReact/common/I18n';
import {
  TASKS_TABLE_ID,
  SELECT_ROWS,
  UNSELECT_ALL_ROWS,
  UNSELECT_ROWS,
  UPDATE_CLICKED,
  TASKS_RESUME_REQUEST,
  TASKS_RESUME_SUCCESS,
  TASKS_RESUME_FAILURE,
  TASKS_CANCEL_REQUEST,
  TASKS_CANCEL_SUCCESS,
  TASKS_CANCEL_FAILURE,
} from './TasksTableConstants';
import { TOAST_TYPES } from '../common/ToastTypesConstants';
import { getApiPathname } from './TasksTableHelpers';
import { fetchTasksSummary } from '../TasksDashboard/TasksDashboardActions';

export const getTableItems = url =>
  getTableItemsAction(TASKS_TABLE_ID, getURIQuery(url), getApiPathname(url));

export const cancelTask = ({
  taskId,
  taskName,
  url,
  parentTaskID,
}) => async dispatch => {
  await dispatch(cancelTaskRequest(taskId, taskName));
  dispatch(getTableItems(url));
  dispatch(fetchTasksSummary(getURIQuery(url).time, parentTaskID));
};

export const cancelTaskRequest = (id, name) => async dispatch => {
  dispatch(
    addToast({
      type: TOAST_TYPES.INFO,
      message: `${__('Trying to cancel')} "${name}" ${__('task')}`,
    })
  );
  try {
    await API.post(`/foreman_tasks/tasks/${id}/cancel`);
    dispatch(
      addToast({
        type: TOAST_TYPES.SUCCESS,
        message: `"${name}" ${__('Task cancelled')}`,
      })
    );
  } catch ({ response }) {
    dispatch(
      addToast({
        type: TOAST_TYPES.ERROR,
        message: `"${name}" ${__('Task cannot be cancelled at the moment.')}`,
      })
    );
  }
};

export const resumeTask = ({
  taskId,
  taskName,
  url,
  parentTaskID,
}) => async dispatch => {
  await dispatch(resumeTaskRequest(taskId, taskName));
  dispatch(getTableItems(url));
  dispatch(fetchTasksSummary(getURIQuery(url).time), parentTaskID);
};

export const resumeTaskRequest = (id, name) => async dispatch => {
  try {
    await API.post(`/foreman_tasks/tasks/${id}/resume`);
    dispatch(
      addToast({
        type: TOAST_TYPES.SUCCESS,
        message: __(`"${name}" ${__('Task execution was resumed')}`),
      })
    );
  } catch ({ response }) {
    dispatch(
      addToast({
        type: TOAST_TYPES.ERROR,
        message: __(`Task "${name}" has to be resumable.`),
      })
    );
  }
};

export const selectAllRows = results => ({
  type: SELECT_ROWS,
  payload: results.map(row => row.id),
});

export const unselectAllRows = () => ({
  type: UNSELECT_ALL_ROWS,
});

export const selectRow = id => ({
  type: SELECT_ROWS,
  payload: [id],
});

export const unselectRow = id => ({
  type: UNSELECT_ROWS,
  payload: id,
});

export const bulkResumeRequest = resumeTasks => {
  const ids = resumeTasks.map(task => task.id);
  const url = '/foreman_tasks/api/tasks/bulk_resume';
  const data = { task_ids: ids };
  return API.post(url, data);
};

const bulkCancelRequest = cancelTasks => {
  const ids = cancelTasks.map(task => task.id);
  const url = '/foreman_tasks/api/tasks/bulk_cancel';
  const data = { task_id: ids };
  return API.post(url, data);
};

export const bulkResume = ({
  selected,
  url,
  parentTaskID,
}) => async dispatch => {
  const resumeTasks = selected.filter(task => task.isResumable);
  if (resumeTasks.length < selected.length)
    dispatch(
      addToast({
        type: TOAST_TYPES.WARNING,
        message: __('Not all the selected tasks can be resumed'),
      })
    );
  if (resumeTasks.length) {
    try {
      dispatch({ type: TASKS_RESUME_REQUEST });
      const { data } = await bulkResumeRequest(resumeTasks);
      dispatch({ type: TASKS_RESUME_SUCCESS });
      const toastInfo = {
        resumed: { type: TOAST_TYPES.SUCCESS, text: 'was resumed' },
        failed: { type: TOAST_TYPES.ERROR, text: 'could not be resumed' },
        skipped: {
          type: TOAST_TYPES.WARNING,
          text: 'task has to be resumable',
        },
      };
      const toastDispatch = (type, name) =>
        dispatch(
          addToast({
            type: toastInfo[type].type,
            message: sprintf(__('%(name)s Task execution %(type)s'), {
              name,
              type: toastInfo[type].text,
            }),
          })
        );

      ['resumed', 'failed', 'skipped'].forEach(type => {
        data[type] &&
          data[type].forEach(task => {
            toastDispatch(type, task.action);
          });
      });
      if (data.resumed) {
        dispatch(getTableItems(url));
        dispatch(fetchTasksSummary(getURIQuery(url).time, parentTaskID));
      }
    } catch (error) {
      dispatch({ type: TASKS_RESUME_FAILURE, error });
      dispatch(
        addToast({
          type: TOAST_TYPES.ERROR,
          message: `${__(`Cannot resume tasks at the moment`)} ${error}`,
        })
      );
    }
  }
};

export const bulkCancel = ({
  selected,
  url,
  parentTaskID,
}) => async dispatch => {
  const cancelTasks = selected.filter(task => task.isCancellable);
  if (cancelTasks.length < selected.length)
    dispatch(
      addToast({
        type: TOAST_TYPES.WARNING,
        message: __('Not all the selected tasks can be cancelled'),
      })
    );
  if (cancelTasks.length) {
    try {
      dispatch({ type: TASKS_CANCEL_REQUEST });
      const { data } = await bulkCancelRequest(cancelTasks);
      dispatch({ type: TASKS_CANCEL_SUCCESS });
      const toastInfo = {
        cancelled: { type: TOAST_TYPES.SUCCESS, text: 'was cancelled' },
        skipped: {
          type: TOAST_TYPES.WARNING,
          text: 'task has to be cancellable',
        },
      };
      const toastDispatch = (type, name) =>
        dispatch(
          addToast({
            type: toastInfo[type].type,
            message: sprintf(__('%(name)s Task execution %(type)s'), {
              name,
              type: toastInfo[type].text,
            }),
          })
        );
      ['cancelled', 'skipped'].forEach(type => {
        data[type] &&
          data[type].forEach(task => {
            toastDispatch(type, task.action);
          });
      });
      if (data.cancelled) {
        dispatch(getTableItems(url));
        dispatch(fetchTasksSummary(getURIQuery(url).time, parentTaskID));
      }
    } catch (error) {
      dispatch({ type: TASKS_CANCEL_FAILURE, error });
      dispatch(
        addToast({
          type: TOAST_TYPES.ERROR,
          message: `${__(`Cannot cancel tasks at the moment`)} ${error}`,
        })
      );
    }
  }
};

export const openClickedModal = ({ taskId, taskName, setModalOpen }) => {
  setModalOpen();
  return {
    type: UPDATE_CLICKED,
    payload: { clicked: { taskId, taskName } },
  };
};
