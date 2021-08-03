import React from 'react'
import Reconciler, { HostConfig } from 'react-reconciler'

import { isCustomElementName } from './custom-react'
import { performanceNow } from './utils'


interface ReactTreeRawItem
{
	readonly type: 'text' | 'node';

	clear( ): void;
}

abstract class ReactTreeItem implements ReactTreeRawItem
{
	abstract readonly type: ReactTreeRawItem[ 'type' ];

	protected children: Array< ReactTreeItem > = [ ];

	clear( )
	{
		this.children.forEach( child => child.clear( ) );
		this.children.length = 0;
	}
}

export class ReactTreeText extends ReactTreeItem
{
	readonly type = 'text';

	constructor( public readonly text: string )
	{
		super( );
	}
}

export class ReactTreeNode< T extends { } = any, Context = unknown >
	extends ReactTreeItem
{
	readonly type = 'node';

	constructor(
		public readonly elementType: string,
		public readonly props: T,
		public readonly context: Context
	)
	{
		super( );
	}

	_appendChild( ...children: ReactTreeItem[ ] )
	{
		this.children.push( ...children );
		this.onChildrenChanged( );
	}

	_insertBefore( child: ReactTreeItem, beforeChild: ReactTreeItem )
	{
		const index = this.children.indexOf( beforeChild );
		if ( index === -1 )
			throw new RangeError(
				`Tree items doesn't have child ${beforeChild}`
			);
		this.children.splice( index, 0, child );
		this.onChildrenChanged( );
	}

	_removeChild( ...children: ReactTreeItem[ ] )
	{
		children.forEach( child =>
		{
			const index = this.children.indexOf( child );
			if ( index === -1 )
				throw new RangeError(
					`Tree items doesn't have child ${child}`
				);
			this.children.splice( index, 1 );
		} );
		this.onChildrenChanged( );
	}

	onChildrenChanged( ) { }
	onFinalizeChildren( ) { }
	onPropsChanged( ) { }
}


export type ContainerNode< Context > = ReactTreeNode< { }, Context > & {
	getChildren( ): ReadonlyArray< ReactTreeItem >;
	doClear( ): void;
	onPrepareForCommit?( ): void;
	onResetAfterCommit?( ): void;
};

// Default implementation of a Container (root node)
class ContainerImpl< Context >
	extends ReactTreeNode< { }, Context >
	implements ContainerNode< Context >
{
	readonly type = 'node';

	constructor( ctx: Context )
	{
		super( 'root', { }, ctx );
	}

	getChildren( )
	{
		return this.children;
	}

	doClear( )
	{
		this.clear( );
	}

	onPrepareForCommit( )
	{ }

	onResetAfterCommit( )
	{ }
};


export type ElementNodeConstructor< Props, Context > =
	( type: string, props: Props, ctx: Context ) => ReactTreeNode;

export type ElementDefinition< Props, Context > =
	[ React.ComponentType< Props >, ElementNodeConstructor< Props, Context > ];

export interface ElementSetup<
	Elements extends ElementDefinition< any, any >,
	Context
>
{
	elements: Elements[ ];
	context: Context;
}

export interface ElementSetupResult< Context >
{
	elements: {
		[ NodeType: string ]: ElementNodeConstructor< any, Context >;
	};
	context: Context;
}

export function setupElements<
	Context,
	Elements extends ElementDefinition< any, any >
>( setup: ElementSetup< Elements, Context > )
: ElementSetupResult< Context >
{
	const elements = Object.fromEntries(
		setup.elements
		.map( ( [ Component, constructor ] ): [ string, typeof constructor ] =>
			[ Component.displayName ?? Component.name, constructor ]
		)
	);

	return { elements, context: setup.context };
}


// Host config types
type HostType = any;
type HostProps = any;
type Instance = ReactTreeNode;
type TextInstance = ReactTreeText;
type SuspenseInstance = any;
type HydratableInstance = any;
type PublicInstance = Instance | TextInstance;
interface UpdatePayload {
	removed: Array< string >;
	added: Array< string >;
	changed: Record< string, unknown >;
}
type TimeoutHandle = any;
type NoTimeout = number;


export type AnyElements = Record< string, ElementDefinition< any, any > >;

export interface ReactTreeSetup< Context >
{
	debugLogReconciliation( message: string, ...args: any ): void;

	elementSetup: ElementSetupResult< Context >;

	makeText( text: string ): ReactTreeText;
	makeNode(
		elementType: string,
		props: Record< string, unknown >,
		context: Context
	): ReactTreeNode< { }, Context >;
}

function makeHostConfig< Context >( opts: ReactTreeSetup< Context > )
{
	const {
		debugLogReconciliation: debug,
		elementSetup,
		makeText,
		makeNode,
	} = opts;

	const { context } = elementSetup;

	const notImplemented = ( thing: string, ...args: any ) =>
		console.log( `"${thing}" not implemented!`, ...args );

	const hostConfig: HostConfig<
		HostType,
		HostProps,
		ContainerNode< Context >,
		Instance,
		TextInstance,
		SuspenseInstance,
		HydratableInstance,
		PublicInstance,
		Context,
		UpdatePayload,
		unknown, // _ChildSet, // TODO Placeholder for undocumented API
		TimeoutHandle,
		NoTimeout
	> = {
		supportsMutation: true,
		supportsPersistence: false,

		createInstance( type, props, rootContainer, hostContext, handle )
		{
			debug(
				'createInstance',
				{ type, props, rootContainer, hostContext, handle }
			);

			const {
				'data-type': dataType,
				'data-props': dataProps,
				children,
			} = props;

			const isCustomElement =
				isCustomElementName( type )
				&&
				elementSetup.elements[ dataType ];

			const [ nodeType, ctor ] =
				!isCustomElement
				? [ type, makeNode ]
				: [ dataType, elementSetup.elements[ dataType ] ];

			return ctor( nodeType, { ...dataProps, children }, context );
		},

		createTextInstance( text, rootContainer, hostContext, handle )
		{
			debug(
				'createTextInstance',
				{ text, rootContainer, hostContext, handle }
			);

			return makeText( text );
		},

		appendInitialChild( parentInstance, child )
		{
			debug( 'appendInitialChild', { parentInstance, child } );

			parentInstance._appendChild( child );
		},

		finalizeInitialChildren(
			instance,
			type,
			props,
			rootContainer,
			hostContext
		)
		{
			debug(
				'finalizeInitialChildren',
				{ instance, type, props, rootContainer, hostContext }
			);

			instance.onFinalizeChildren( );

			return false;
		},

		prepareUpdate(
			instance,
			type,
			oldProps,
			newProps,
			rootContainer,
			hostContext,
		)
		{
			debug(
				'prepareUpdate',
				{
					instance,
					type,
					oldProps,
					newProps,
					rootContainer,
					hostContext,
				}
			);

			const pOld = oldProps[ 'data-props' ] ?? { };
			const pNew = newProps[ 'data-props' ] ?? { };

			const setOld = new Set( Object.keys( pOld ) );
			const setNew = new Set( Object.keys( pNew ) );

			const removed: Array< string > = [ ...setOld ]
				.filter( key => !setNew.has( key ) );
			const added: Array< string > = [ ...setNew ]
				.filter( key => !setOld.has( key ) );
			const changed: Record< string, unknown > = Object.fromEntries(
				[ ...setOld ]
				.filter( key =>
					setNew.has( key ) && pOld[ key ] !== pNew[ key ]
				)
				.map( key => [ key, pNew[ key ] ] )
			);

			if (
				removed.length === 0 &&
				added.length === 0 &&
				Object.keys( changed ).length === 0
			)
				return null;

			return {
				removed,
				added,
				changed,
			};
		},

		shouldSetTextContent( type, props )
		{
			debug( 'shouldSetTextContent', { type, props } );
			return false;
		},

		getRootHostContext( rootContainer )
		{
			debug( 'getRootHostContext', { rootContainer } );
			return context;
		},

		getChildHostContext( parentHostContext, type, rootContainer )
		{
			debug(
				'getChildHostContext',
				{ parentHostContext, type, rootContainer }
			);
			return parentHostContext;
		},

		// istanbul ignore next
		getPublicInstance( instance )
		{
			debug( 'getPublicInstance', { instance } );
			return instance;
		},

		prepareForCommit( container )
		{
			debug( 'prepareForCommit', { container } );

			container.onPrepareForCommit?.( );
			return null;
		},

		resetAfterCommit( container )
		{
			debug( 'resetAfterCommit', { container } );

			container.onResetAfterCommit?.( );
		},

		// istanbul ignore next
		preparePortalMount( containerInfo )
		{
			debug( 'preparePortalMount', { containerInfo } );
			notImplemented( "preparePortalMount" );
		},

		// istanbul ignore next
		now( )
		{
			return performanceNow( );
		},

		// istanbul ignore next
		scheduleTimeout( fn, delay )
		{
			debug( 'scheduleTimeout', { fn, delay } );

			return setTimeout( fn, delay );
		},

		// istanbul ignore next
		cancelTimeout( id )
		{
			debug( 'cancelTimeout', { id } );

			clearTimeout( id );
		},

		noTimeout: -1,

		isPrimaryRenderer: true,

		appendChild( parentInstance, child )
		{
			debug( 'appendChild', { parentInstance, child } );

			parentInstance._appendChild( child );
		},

		appendChildToContainer( container, child )
		{
			debug( 'appendChildToContainer', container, child  );

			container._appendChild( child );
		},

		insertBefore( parentInstance, child, beforeChild )
		{
			debug( 'insertBefore', { parentInstance, child, beforeChild } );

			parentInstance._insertBefore( child, beforeChild );
		},

		insertInContainerBefore( container, child, beforeChild )
		{
			debug(
				'insertInContainerBefore',
				{ container, child, beforeChild }
			);

			container._insertBefore( child, beforeChild );
		},

		removeChild( parentInstance, child )
		{
			debug( 'removeChild', { parentInstance, child } );

			parentInstance._removeChild( child );
		},

		removeChildFromContainer( container, child )
		{
			debug( 'removeChildFromContainer', { container, child } );

			container._removeChild( child );
		},

		resetTextContent( instance )
		{
			debug( 'resetTextContent', { instance } );
			notImplemented( "resetTextContent" );
		},

		commitTextUpdate( textInstance, oldText, newText )
		{
			debug( 'commitTextUpdate', { textInstance, oldText, newText } );
			notImplemented( "commitTextUpdate" );
		},

		// istanbul ignore next
		commitMount( instance, type, props, internalInstanceHandle )
		{
			debug(
				'commitMount',
				{ instance, type, props, internalInstanceHandle }
			);
			notImplemented( "commitMount" );
		},

		commitUpdate(
			instance,
			updatePayload,
			type,
			prevProps,
			nextProps,
			handle
		)
		{
			debug(
				'commitUpdate',
				{ instance, updatePayload, type, prevProps, nextProps, handle }
			);

			const { removed, added, changed } = updatePayload;
			removed.forEach( key =>
			{
				delete instance.props[ key ];
			} );
			added.forEach( key =>
			{
				instance.props[ key ] = nextProps[ key ];
			} );
			Object.assign( instance.props, changed );
			instance.onPropsChanged( );
		},

		hideInstance( instance )
		{
			debug( 'hideInstance', { instance } );
			notImplemented( 'hideInstance' );
		},

		hideTextInstance( textInstance )
		{
			debug( 'hideTextInstance', { textInstance } );
			notImplemented( 'hideTextInstance' );
		},

		unhideInstance( instance, props )
		{
			debug( 'unhideInstance', { instance, props } );
			notImplemented( 'unhideInstance' );
		},

		unhideTextInstance( textInstance, text )
		{
			debug( 'unhideTextInstance', { textInstance, text } );
			notImplemented( 'unhideTextInstance' );
		},

		clearContainer( container )
		{
			debug( 'clearContainer', { container } );

			container.doClear( );
		},

		supportsHydration: false,
	};

	return { hostConfig };
}


export interface ReconcilerSetup< Context >
{
	debugLogReconciliation?:
		ReactTreeSetup< Context >[ 'debugLogReconciliation' ];
	elementSetup: ElementSetupResult< Context >;
	rootContainer?: ContainerNode< Context >;
}

export function setupReconciler< Context >(
	element: React.ReactNode,
	{
		debugLogReconciliation = ( ) => { },
		elementSetup,
		rootContainer = new ContainerImpl( elementSetup.context ),
	}: ReconcilerSetup< Context >
)
{
	const reactTreeSetup: ReactTreeSetup< Context > = {
		debugLogReconciliation,
		elementSetup,
		makeText: ( text ) => new ReactTreeText( text ),
		makeNode: ( type, props ) =>
			new ReactTreeNode( type, props, elementSetup.context ),
	};

	const { hostConfig } = makeHostConfig( reactTreeSetup );

	const reconciler = Reconciler( hostConfig );

	const render = ( ) =>
	{
		const opaqueRoot = reconciler.createContainer(
			rootContainer,
			0,
			false,
			null
		);

		const containerId = reconciler.updateContainer(
			element,
			opaqueRoot,
			undefined,
			( ) => { }
		);

		const rootInstance = reconciler.getPublicRootInstance( opaqueRoot );

		return { containerId, rootInstance };
	};

	return { rootContainer, reconciler, render };
}
