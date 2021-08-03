[![npm version][npm-image]][npm-url]
[![downloads][downloads-image]][npm-url]
[![build status][build-image]][build-url]
[![coverage status][coverage-image]][coverage-url]
[![Language grade: JavaScript][lgtm-image]][lgtm-url]
[![Node.JS version][node-version]][node-url]


`react-tree-reconciler` is a simpler API of the React reconciler. It can be seen as a React reconciler factory. It makes assumptions, and has specializations which makes it unsuitable for very complex applications. In many cases though, this package works well and is a whole lot simpler than building a reconciler from scratch.


# API

The package contains three main pieces;

 * A way to create custom "native" components (think; `a`, `div`, `span` if this was for the web)
 * A connection between such a "native" component and a custom class (where an instance of the component becomes an instance of the class)
 * Bootstrapping a React tree lifecycle


## Native components

Create native components using `makeComponent`. This takes a props type and a textual name, and returns the component in an object with that same name. This API decision has technical reasons which hides complexity, and is easy to use right, and hard to misuse. It's easy to create a file containing the components and exporting them.

Example;

```ts
// components.ts
import { makeComponent } from 'react-tree-reconciler'

export interface FooProps
{
    title: string;
    description?: string;
}
export const { Foo } = makeComponent< FooProps >( )( 'Foo' );

export interface BarProps { /* ... */ }
export const { Bar } = makeComponent< BarProps >( )( 'Bar' );
```

This component can now be used as:

```ts
import { Foo } from './components.ts'

function ManyFoos( )
{
    // Hooks are of course supported in user-created components
    // since a true React is used with the corresponding lifecycles.
    const [ desc, setDesc ] = useState( 'second foo' );

    return <>
        <Foo title="foo 1" />
        <Foo title="foo 2" description={ desc } />
    </>
}
```

To create a component which shouldn't be able to have children, use `makeVoidComponent`.


## Connecting a React component with a class


### Tree classes

Each node in the react tree will create a corresponding instance of `ReactTreeItem` which is either a `ReactTreeText` or a `ReactTreeNode`.

The `ReactTreeText` is a class which only has the useful `text` property being the string corresponding to the free text. It also has a property `type` being `"text"`.

The `ReactTreeNode< Props, Context >` has the `type` property set to `"node"`, and then has the following properties:

 * `elementType: string`<br/>This is the React name of the component, as provided to `makeComponent()`
 * `props: Props`<br/>Raw React props
 * `context: Context`<br/>Optional context

It also has the following no-op functions which can be overridden:

 * `onChildrenChanged( )`<br/>Called when the children change (added, removed, replaced)
 * `onFinalizeChildren( )`<br/>Called the first time the children are provided
 * `onPropsChanged( )`<br/>Called when the props have changed

You can provide a custom constructor function which returns a subclassed instance of `ReactTreeNode`, so that you can store arbitrary other data on the nodes, and if necessary, use data in the Context.

Example;

```ts
class MyFooImpl extends ReactTreeNode< FooProps, Context >
{
	static make( type: string, props: FooProps, context: Context )
	{
		return new MyFooImpl( type, props, context );
	}

	public getMagicTitle( )
	{
		return "magic " + this.props.title;
	}
}
```

You can the provide `MyFooImpl.make` as the constructor to instances of the React component `Foo` as defined above, see [Connection](#connection) below.


### Context

When creating a reconciler and a tree of components, `react-tree-reconciler` allows you to provide a custom "context". A type safe piece of data you control entirely yourself. This can contain necessary information about the tree as a whole and connections to the rest of your app.


### Connection

Use `setupElements` to connect React components to your custom classes:

```ts
import { Foo, Bar } from './components'

// Context can be null if you don't need it, or any data you like
type Context = { foo: number };
const context: Context = { foo: 42 };

class MyFooImpl extends ReactTreeNode< ... > { ... }

const elementSetup = setupElements( {
    elements: [
        [ Foo, MyFooImpl.make ],
        [ Bar, MyBarImpl.make ],
    ],
    context,
} );
```


## Bootstrapping a React tree lifecycle

Use `setupReconciler` and the returned `render` to bootstrap the React tree.

> Note that you can have multiple React trees (and their corresonding lifecycles) concurrently in your app!

```ts
const { rootContainer, render } = setupReconciler(
    <ManyFoos />,
    { elementSetup }
);

render( );
```

The `rootContainer` is an object similar to your subclassed tree _nodes_, and has a function `getChildren( )` which can be used to iterate the the children of this root. From there on, you can iterate by accessing the `children` property on each sub-node, as long as it's a subclas of `ReactTreeNode` and not `ReactTreeText`.

You can provide a custom root container, as long as it extends `ReactTreeNode` and implements `ContainerNode`:

```ts
interface ContainerNode
{
    doClear( ): void;
    onPrepareForCommit?( ): void;
    onResetAfterCommit?( ): void;
}
```

`doClear` should probably call `this.clear( );` to clear the entire tree.

The other functions are optional to implement, and are called before and after the tree has been mutaded by the reconciler. These are often not necessary to implement.

Finally, add an instance of this container class called `rootContainer` to the second options object in the call to `setupReconciler` and that will be used as the root container, rather than an automatically created one.


### Debug logging

If you want to see debug logs from the reconciler, to understand what's going on (NOTE; it's going to be massive amounts of logs), you can provide yet another option in the second options object to `setupReconciler` - a function called `debugLogReconciliation` on the form `( message: string, ...args: any ) => void`



[npm-image]: https://img.shields.io/npm/v/react-tree-reconciler.svg
[npm-url]: https://npmjs.org/package/react-tree-reconciler
[downloads-image]: https://img.shields.io/npm/dm/react-tree-reconciler.svg
[build-image]: https://img.shields.io/github/workflow/status/grantila/react-tree-reconciler/Master.svg
[build-url]: https://github.com/grantila/react-tree-reconciler/actions?query=workflow%3AMaster
[coverage-image]: https://coveralls.io/repos/github/grantila/react-tree-reconciler/badge.svg?branch=master
[coverage-url]: https://coveralls.io/github/grantila/react-tree-reconciler?branch=master
[lgtm-image]: https://img.shields.io/lgtm/grade/javascript/g/grantila/react-tree-reconciler.svg?logo=lgtm&logoWidth=18
[lgtm-url]: https://lgtm.com/projects/g/grantila/react-tree-reconciler/context:javascript
[node-version]: https://img.shields.io/node/v/react-tree-reconciler
[node-url]: https://nodejs.org/en/
