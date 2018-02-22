<p align="center">
  <b style="font-size: 32px;">lessdux</b>
</p>

<p align="center">
  <a href="https://travis-ci.org/kleros/lessdux"><img src="https://travis-ci.org/kleros/lessdux.svg?branch=master" alt="Build Status"></a>
  <a href="https://coveralls.io/github/kleros/lessdux?branch=master"><img src="https://coveralls.io/repos/github/kleros/lessdux/badge.svg?branch=master" alt="Coverage Status"></a>
  <a href="https://david-dm.org/kleros/lessdux"><img src="https://david-dm.org/kleros/lessdux.svg" alt="Dependencies"></a>
  <a href="https://david-dm.org/kleros/lessdux?type=dev"><img src="https://david-dm.org/kleros/lessdux/dev-status.svg" alt="Dev Dependencies"></a>
  <a href="https://github.com/facebook/jest"><img src="https://img.shields.io/badge/tested_with-jest-99424f.svg" alt="Tested with Jest"></a>
  <a href="https://standardjs.com"><img src="https://img.shields.io/badge/code_style-standard-brightgreen.svg" alt="JavaScript Style Guide"></a>
  <a href="https://github.com/prettier/prettier"><img src="https://img.shields.io/badge/styled_with-prettier-ff69b4.svg" alt="Styled with Prettier"></a>
  <a href="https://conventionalcommits.org"><img src="https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg" alt="Conventional Commits"></a>
  <a href="http://commitizen.github.io/cz-cli/"><img src="https://img.shields.io/badge/commitizen-friendly-brightgreen.svg" alt="Commitizen Friendly"></a>
</p>

# What is This?

`redux` is a great library for managing the state of your applications. It does, however, require a lot of boilerplate code. If you've worked with raw `redux` before then you know that feeling when you have to write a new action constant, a new action creator, and maybe even a new reducer for doing something simple like fetching an object from a database. Furthermore, when you are dealing with async resources, (resources that are fetched asynchronously from remote services), there is even more boilerplate for when the resource is being created, loaded, when an error is thrown, etc. Libraries like `apollo-client` that use `redux` take care of this under the hood, but if you don't have a GraphQL service then you are out of luck. `lessdux` is a much lower level library that makes it easier to deal with async resources in raw `redux` and also provides some nice utilities in the process.

## Installation

To install, run `yarn add lessdux` or `npm install lessdux`.

## Create a Reducer

`createReducer` takes the `initialState` of the reducer and an optional `reducerMap` and `onStateChange` callback.

`reducerMap` is simply an object that maps action constants to reducer functions with signature `(state, action) => newState`. It is not necessary to provide this argument as the reducer can function without it.

The secret sauce of the reducer returned from `createReducer` is its ability to automatically react to async resource 'action type prefixes'. This means that whenever an action is dispatched with `action.type = ${ACTION_TYPE_PREFIX}_${RESOURCE_NAME}`, e.g.`FETCH_USER`, if the reducer's slice of the state has a key that is the camelCased name of the resource, i.e. `user`, it will automatically set its `loading` prop to `true` and its `failedLoading` prop to `false`. More on this below.

The `onStateChange` callback is called whenever the reducer returns a new state object. This is useful for reacting to automatic or global state changes for doing things like rebuilding tooltips or reattaching DOM event listeners in one place.

This is how you might call it:

```js
/* reducers/user.js */
import { createReducer } from 'lessdux'

// Reducer
export default createReducer(
  { username: 'placeholder' }, // Initial state
  {
    SET_USERNAME: (state, action) => { ...state, username: action.payload.username } // Return new state object
  },
  ReactTooltip.rebuild // Reattach tooltips
)
```

## Create a Resource

Resources are the individual objects that you fetch from your remote services. These objects could be lists (arrays), mappings (objects), or even primitive types like strings or numbers. For every resource you use you'll have to define a `prop-types` shape and an initial state for your reducer. Since the only variable here is the shape of the actual object, we made a utility for doing this:

```js
/* reducers/user.js */
import { createResource, createReducer } from 'lessdux'

// Shapes
const {
  shape: statusesShape,
  initialState: statusesInitialState
} = createResource(PropTypes.arrayOf(PropTypes.string)) // This is the shape of the object returned from your remote services, an array of strings in this case
export { statusesShape } // Export shapes for use in components `propTypes`, E.g. Component.propTypes = { statuses: statusesShape.isRequired }

// Reducer
export default createReducer(
  { username: 'placeholder', statuses: statusesInitialState } // Initial state
  // ...
)
```

The returned shape will look like this:

```js
const statusesInitialState = PropTypes.shape({
  loading: PropTypes.bool.isRequired,
  data: PropTypes.arrayOf(PropTypes.string),
  failedLoading: PropTypes.bool.isRequired
})
```

You may also pass the following configuration object to add the extra states. More on this below.

```js
const {
  shape: statusesShape,
  initialState: statusesInitialState
} = createResource(PropTypes.arrayOf(PropTypes.string), {
  // Add all extra states
  withCreate: true,
  withUpdate: true,
  withDelete: true
})
export { statusesShape }
```

## Create Actions

You will also need to create the respective actions for this resource. We also have a utility for that:

```js
/* actions/user.js */
import { createActions } from 'lessdux'

/* Actions */

// Statuses
export const statuses = createActions('STATUSES')

/* Action Creators */

// Statuses
export const fetchStatuses = () => ({ type: statuses.FETCH })
```

`createActions` takes a CONSTANT_CASE resource name and returns an object with action constants for `FETCH`, `RECEIVE`, and `FAIL_FETCH`. No need to append the resource name yourself. You may also pass the configuration object for creating, updating, and deleting just like with `createResource`.

If you want to add custom action constants, you may do so like so:

```js
export const statuses = {
  ...createActions('STATUSES'),
  LIKE: 'LIKE_STATUSES'
}
```

## The Different States and 'Action Type Prefixes'

These are all the 'action type prefixes' that a reducer reacts to and the properties they set on the resource shape object:

```js
const actionTypePrefixesToState = {
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
```

`RECEIVE_${any}` actions will also set the value of `data` to the value of `action.payload.${camelCaseResourceName}`. This means you don't have to write a function just to receive the result of a `FETCH`. Pretty neat right?

# Render If?

Naturally, you'll want to render different things depending on the state of the resource and we have a component that does just that:

```js
/* statuses-list.js */
import { RenderIf } from 'lessdux'

import { statusesShape } from '../reducers/user'
import Spinner from '../components/spinner'

const StatusesList = ({ statuses }) => (
  <div>
    Look at Your Statuses
    <ul>
      <RenderIf
        loading={<Spinner />} // Rendered while loading
        data={statuses.data && statuses.data.map(s => <li>{s}</li>)} // Rendered when data is ready
        failedLoading="There was an error loading your statuses..." // Rendered on errors
      />
    </ul>
  </div>
)

StatusesList.propTypes = {
  statuses: statusesShape.isRequired
}

export default StatusesList
```

This is the full list of props `RenderIf` can receive:

* `resource // The resource object shape, (required)`
* `creating // Render while creating`
* `loading // Render while loading`
* `updating // Render while updating`
* `deleting // Render while deleting`
* `done // Render when done and data is ready`
* `failedCreating // Render on creating failure`
* `failedLoading // Render on loading failure`
* `failedUpdating // Render on updating failure`
* `failedDeleting // Render on deleting failure`
* `loadingExtra // Render when any value in extraLoadingValues is true, (defaults to loading prop)`
* `failedLoadingExtra // Render when any value in extraFailedValues is true, (defaults to failedLoading prop)`
* `extraLoadingValues // Array of extra values that if truthy, signify that the resource is still loading`
* `extraValues // Array of extra values that if null or undefined signify that the resource failed to load`
* `extraFailedValues // Array of extra values that if truthy, signify that the resource failed loading`

## Example Usage with `redux-saga`

This is how you might use it with a library like `redux-saga`:

```js
import { takeLatest, call, put, select } from 'redux-saga/effects'

import * as userActions from '../actions/user'
import myAPICaller from '../utils/my-api-caller'

/**
 * Fetches the statuses.
 */
function* fetchStatuses() {
  try {
    const statuses = yield call(myAPICaller, '/statuses')

    yield put(action(userActions.statuses.RECEIVE, { statuses }))
  } catch (err) {
    yield put(errorAction(userActions.statuses.FAIL_FETCH, err))
  }
}

/**
 * Likes all the statuses.
 */
function* likeStatuses() {
  try {
    yield put(action(userActions.statuses.UPDATE))

    const statuses = yield call(myAPICaller, '/statuses/like')

    yield put(action(userActions.statuses.RECEIVE_UPDATED, { statuses }))
  } catch (err) {
    yield put(errorAction(userActions.statuses.FAIL_UPDATE, err))
  }
}

/**
 * The root of the user saga.
 */
export default function* arbitratorSaga() {
  // Statuses
  yield takeLatest(userActions.statuses.FETCH, fetchStatuses)
  yield takeLatest(userActions.statuses.LIKE, likeStatuses) // This is our custom action!
}
```
