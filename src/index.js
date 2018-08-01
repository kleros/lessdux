import PropTypes from 'prop-types'

import { constantToCamelCase } from './utils'

const actionTypePrefixMap = {
  CREATE: { creating: true, failedCreating: false },
  RECEIVE_CREATED: { creating: false, failedCreating: false },
  FAIL_CREATE: { creating: false, failedCreating: true },
  UPDATE: { updating: true, failedUpdating: false },
  RECEIVE_UPDATED: { updating: false, failedUpdating: false },
  FAIL_UPDATE: { updating: false, failedUpdating: true },
  DELETE: { deleting: true, failedDeleting: false },
  RECEIVE_DELETED: { deleting: false, failedDeleting: false },
  FAIL_DELETE: { deleting: false, failedDeleting: true },

  FETCH: { loading: true, failedLoading: false },
  RECEIVE: { loading: false, failedLoading: false },
  FAIL_FETCH: { loading: false, failedLoading: true }
}

/**
 * Util that makes creating reducers easier.
 * @param {object} initialState - The initial state for the reducer.
 * @param {object} reducerMap - A map of action type string constants to functions that return a slice of state.
 * @param {function(): any} onStateChange - A callback for when `action.type` has a prefix that matches and the state will be changed automatically.
 * @returns {function(state: object, action: object): object} - A reducer function.
 */
export default function createReducer(initialState, reducerMap, onStateChange) {
  return (state = initialState, action) => {
    let newState =
      reducerMap && reducerMap[action.type]
        ? reducerMap[action.type](state, action)
        : state
    if (state === newState) newState = { ...state }

    for (const typePrefix of Object.keys(actionTypePrefixMap)) {
      const typePrefixLen = typePrefix.length
      const actionTypePrefix = action.type.slice(0, typePrefixLen)
      if (typePrefix === actionTypePrefix) {
        const resource = constantToCamelCase(
          action.type.slice(typePrefixLen + 1)
        )
        if (state[resource]) {
          const notHandled = !reducerMap || !reducerMap[action.type]
          const isReceive =
            notHandled && typePrefix.slice(0, 'RECEIVE'.length) === 'RECEIVE'
          const isFail =
            notHandled && typePrefix.slice(0, 'FAIL'.length) === 'FAIL'
          const collectionMod = action.payload
            ? action.payload.collectionMod
            : null

          // Action Type Prefix Mod
          newState[resource] = {
            ...newState[resource],
            data: isReceive
              ? collectionMod.resource || action.payload[resource]
              : state[resource].data,
            error: isFail ? collectionMod.error || action.payload : null,
            ...actionTypePrefixMap[typePrefix]
          }

          // Collection Mod
          if (collectionMod) {
            const {
              collection,
              resource: collectionResource,
              updating: collectionUpdating,
              find: collectionFind
            } = collectionMod
            const { data: newStateData, updating: newStateUpdating } = newState[
              collection
            ]

            // Receive collection mod
            if (isReceive) {
              // Add or replace resource in collection
              let data = newStateData
              if (Array.isArray(data)) {
                const collectionIndex =
                  collectionFind &&
                  (typeof collectionFind === 'function'
                    ? data.findIndex(collectionFind)
                    : collectionFind)

                if (collectionIndex !== undefined && collectionIndex !== null)
                  data = [
                    ...data.slice(0, collectionIndex),
                    ...(collectionResource ? [collectionResource] : []),
                    ...data.slice(collectionIndex + 1)
                  ]
                else if (collectionResource)
                  data = [...data, collectionResource]
              } else if (typeof data === 'object')
                data = {
                  ...data,
                  [collectionFind]: collectionResource
                }
              else throw new TypeError('Invalid collection type.')

              if (data !== newStateData)
                newState[collection] = {
                  ...newState[collection],
                  data
                }
            }

            // Update collection mod
            if (collectionUpdating) {
              if (
                isReceive ||
                typePrefix.slice(0, 'FAIL_UPDATE'.length) === 'FAIL_UPDATE'
              ) {
                // Remove the received or failed to update resource's ID from the collection's updating list
                const updatingIndex = newStateUpdating.indexOf(
                  collectionUpdating
                )
                if (updatingIndex !== -1)
                  newState[collection] = {
                    ...newState[collection],
                    updating:
                      newStateUpdating.length === 1
                        ? false
                        : [
                            ...newStateUpdating.slice(0, updatingIndex),
                            ...newStateUpdating.slice(updatingIndex + 1)
                          ]
                  }
              } else {
                // Add resources' IDs to the collection's updating list
                newState[collection] = {
                  ...newState[collection],
                  updating: Array.isArray(newStateUpdating)
                    ? [...newStateUpdating, ...collectionUpdating]
                    : collectionUpdating
                }
              }
            }
          }
        }
        break
      }
    }

    if (state !== newState) setTimeout(onStateChange, 1000) // We are changing the state so call the callback

    return newState
  }
}

/**
 * Creates an initial state object with common loading/error properties and its prop-types shape.
 * @param {object} shape - The prop-types shape to use for the data property.
 * @param {{ withCreate: boolean, withUpdate: boolean, withDelete: boolean }} [options={ withCreate: false, withUpdate: false, withDelete: false }] - Options object for specifying wether the resource can be created, updated, and/or deleted.
 * @returns {{ shape: object, initialState: object }} - an object with a prop-types shape and its initial state object as properties.
 */
export function createResource(
  shape,
  { withCreate = false, withUpdate = false, withDelete = false } = {}
) {
  return {
    shape: PropTypes.shape({
      ...(withCreate
        ? {
            creating: PropTypes.bool.isRequired,
            failedCreating: PropTypes.bool.isRequired
          }
        : null),
      loading: PropTypes.bool.isRequired,
      data: shape,
      error: PropTypes.instanceOf(Error),
      failedLoading: PropTypes.bool.isRequired,
      ...(withUpdate
        ? {
            updating: PropTypes.oneOfType([
              PropTypes.bool,
              PropTypes.arrayOf(PropTypes.number.isRequired)
            ]).isRequired,
            failedUpdating: PropTypes.bool.isRequired
          }
        : null),
      ...(withDelete
        ? {
            deleting: PropTypes.bool.isRequired,
            failedDeleting: PropTypes.bool.isRequired
          }
        : null)
    }),
    initialState: {
      ...(withCreate
        ? {
            creating: false,
            failedCreating: false
          }
        : null),
      loading: false,
      data: null,
      error: null,
      failedLoading: false,
      ...(withUpdate
        ? {
            updating: false,
            failedUpdating: false
          }
        : null),
      ...(withDelete
        ? {
            deleting: false,
            failedDeleting: false
          }
        : null)
    }
  }
}

/**
 * Creates an object with common create, fetch, update, and/or delete action constants for a given resource name.
 * @param {string} resourceName - The name of the resource to create the actions for.
 * @param {{ withCreate: boolean, withUpdate: boolean, withDelete: boolean }} [options={ withCreate: false, withUpdate: false, withDelete: false }] - Options object for specifying wether the resource can be created, updated, and/or deleted.
 * @returns {object} - an object with the action constants as properties.
 */
export function createActions(
  resourceName,
  { withCreate = false, withUpdate = false, withDelete = false } = {}
) {
  const actions = { self: constantToCamelCase(resourceName) }

  for (const typePrefix of Object.keys(actionTypePrefixMap)) {
    if (/CREATE/.test(typePrefix) && !withCreate) continue
    if (/UPDATE/.test(typePrefix) && !withUpdate) continue
    if (/DELETE/.test(typePrefix) && !withDelete) continue

    actions[typePrefix] = typePrefix + '_' + resourceName
  }

  return actions
}

/**
 * Implements common rendering logic for resource objects.
 * @param {object} resource - The resource object whose data rendering depends on.
 * @param {object} renderables - Object with renderables to render depending on conditions.
 * @param {{ extraLoadingValues: any[], extraValues: any[], extraFailedValues: any[] }} [extraValues={}] - Optional extra loading, data, and/or failed values.
 * @returns {any} - A react renderable.
 */
export function renderIf(
  resource,
  {
    creating,
    loading,
    updating,
    deleting,
    done,
    failedCreating,
    failedLoading,
    failedUpdating,
    failedDeleting,
    loadingExtra,
    failedLoadingExtra
  },
  { extraLoadingValues, extraValues, extraFailedValues } = {}
) {
  if (resource.failedCreating) return failedCreating || failedLoading
  if (resource.failedLoading) return failedLoading
  if (resource.failedUpdating) return failedUpdating || failedLoading
  if (resource.failedDeleting) return failedDeleting || failedLoading

  if (resource.creating) return creating || loading
  if (resource.loading) return loading
  if (resource.updating && !Array.isArray(resource.updating))
    return updating || loading
  if (resource.deleting) return deleting || loading

  if (extraFailedValues && extraFailedValues.some(v => v))
    return failedLoadingExtra || failedLoading
  if (extraLoadingValues && extraLoadingValues.some(v => v))
    return loadingExtra || loading

  if (resource.data === null || resource.data === undefined)
    return failedLoading
  if (extraValues && extraValues.some(v => v === null || v === undefined))
    return failedLoadingExtra || failedLoading

  return done
}

// Component version of `renderIf`
export const RenderIf = ({
  resource,
  creating,
  loading,
  updating,
  deleting,
  done,
  failedCreating,
  failedLoading,
  failedUpdating,
  failedDeleting,
  loadingExtra,
  failedLoadingExtra,
  extraLoadingValues,
  extraValues,
  extraFailedValues
}) =>
  renderIf(
    resource,
    {
      creating,
      loading,
      updating,
      deleting,
      done,
      failedCreating,
      failedLoading,
      failedUpdating,
      failedDeleting,
      loadingExtra,
      failedLoadingExtra
    },
    { extraLoadingValues, extraValues, extraFailedValues }
  )
