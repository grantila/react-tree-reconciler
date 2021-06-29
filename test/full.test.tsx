import React, { useEffect, useState } from "react"
import { delay } from "already"

import {
	ReactTreeNode,
	setupReconciler,
	setupElements,
	ReactTreeText,
} from "../lib"
import { TreeItemProps, TreeItem } from "./components"


interface Context
{
	foo: number;
}

class MyTreeItem extends ReactTreeNode< TreeItemProps, Context >
{
	static make( type: string, props: TreeItemProps, context: Context )
	{
		return new MyTreeItem( type, props, context );
	}

	public getTitle( )
	{
		return this.props.title;
	}

	public getDescription( )
	{
		return this.props.description;
	}

	public getChildrenJSON( )
	{
		return this.children
			.map( child =>
				child instanceof MyTreeItem
				? child.toJSON( )
				: { text: ( child as ReactTreeText ).text }
			);
	}

	public toJSON( ): any
	{
		const description = this.getDescription( );
		const children = this.getChildrenJSON( );

		return {
			title: this.getTitle( ),
			...( description && { description } ),
			...( children.length && { children } ),
		};
	}
}

const context: Context = { foo: 42 };

const elementSetup = setupElements( {
	elements: [
		[ TreeItem, MyTreeItem.make ]
	],
	context,
} );

function Inner( props: React.PropsWithChildren< { } > )
{
	const [ dynTitle, setDynTitle ] = useState( 'title' );
	const [ dynDescription, setDynDescription ] = useState( 'description' );
	const [ changed, setChanged ] = useState( false );

	// Once change to true after a while
	useEffect( ( ) =>
	{
		setTimeout( ( ) => { setChanged( true ); }, 200 );
	}, [ ] );

	// Once change values after a while of change
	useEffect( ( ) =>
	{
		if ( !changed ) return;

		setTimeout(
			( ) =>
			{
				setDynTitle( 'dynamic title' );
				setDynDescription( 'changed description' );
			},
			200
		);
	}, [ changed ] );

	return <>
		<TreeItem title="second" description="inner" />
		{
			changed
			? <TreeItem title={ dynTitle } description={ dynDescription } />
			: <TreeItem title="will" description="be replaced" />
		}
		{
			props.children
		}
	</>;
}

function App( )
{
	return <>
		<TreeItem title="first" description="first desc">some text</TreeItem>
		<TreeItem title="middle" description="middle desc">
			<Inner>
				<TreeItem title="inner child" description="inner child desc" />
			</Inner>
		</TreeItem>
		<TreeItem title="last" description="last desc" />
	</>;
}


describe( 'react-tree-reconciler', ( ) =>
{
	it( 'full test', async ( ) =>
	{
		const { rootContainer, render } = setupReconciler(
			<App />,
			{ elementSetup }
		);

		const getTreeJSON = ( ) =>
		{
			const children = rootContainer.getChildren( );
			return children.map( child =>
				child instanceof MyTreeItem ? child.toJSON( ) : undefined
			);
		};

		expect( getTreeJSON( ) ).toStrictEqual( [ ] );

		render( );

		expect( getTreeJSON( ) ).toStrictEqual( [
			{
				title: 'first',
				description: 'first desc',
				children: [ { text: 'some text' } ],
			},
			{
				title: 'middle',
				description: 'middle desc',
				children: [
					{
						title: 'second',
						description: 'inner',
					},
					{
						title: 'will',
						description: 'be replaced',
					},
					{
						title: 'inner child',
						description: 'inner child desc',
					},
				],
			},
			{
				title: 'last',
				description: 'last desc',
			},
		] );

		// This isn't ideal for a test, should be fixed...
		await delay( 250 );

		expect( getTreeJSON( ) ).toStrictEqual( [
			{
				title: 'first',
				description: 'first desc',
				children: [ { text: 'some text' } ],
			},
			{
				title: 'middle',
				description: 'middle desc',
				children: [
					{
						title: 'second',
						description: 'inner',
					},
					{
						title: 'title',
						description: 'description',
					},
					{
						title: 'inner child',
						description: 'inner child desc',
					},
				],
			},
			{
				title: 'last',
				description: 'last desc',
			},
		] );

		// This isn't ideal for a test, should be fixed...
		await delay( 200 );

		expect( getTreeJSON( ) ).toStrictEqual( [
			{
				title: 'first',
				description: 'first desc',
				children: [ { text: 'some text' } ],
			},
			{
				title: 'middle',
				description: 'middle desc',
				children: [
					{
						title: 'second',
						description: 'inner',
					},
					{
						title: 'dynamic title',
						description: 'changed description',
					},
					{
						title: 'inner child',
						description: 'inner child desc',
					},
				],
			},
			{
				title: 'last',
				description: 'last desc',
			},
		] );
	} );
} );
