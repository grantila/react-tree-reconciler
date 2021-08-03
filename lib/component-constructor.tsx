import React from 'react'
import type {
	ComponentType,
	ComponentClass,
	VoidFunctionComponent,
} from 'react'

import { makeElementName } from './custom-react'
import { arrayify } from './utils'

export type VoidComponentType< Props extends { } > =
	ComponentClass< Props > | VoidFunctionComponent< Props >;

export type ComponentDefinition< Name extends string, Props extends { } > =
	{ [ K in Name ]: ComponentType< Props >; };

export type VoidComponentDefinition< Name extends string, Props extends { } > =
	{ [ K in Name ]: VoidComponentType< Props >; };

export function makeComponent< Props >( )
: < Name extends string >( name: Name ) => ComponentDefinition< Name, Props >
{
	return < Name extends string >( name: Name )
	: ComponentDefinition< Name, Props > =>
	{
		type ComponentType =
			React.FunctionComponent< React.PropsWithChildren< Props > >;

		const Component: ComponentType = ( props ) =>
		{
			const { children, ...rest } = props;

			return React.createElement(
				makeElementName( name ),
				{
					'data-type': name,
					'data-props': rest,
				},
				...arrayify( children )
			);
		}

		Object.defineProperty(
			Component,
			'name',
			{ value: name, writable: false }
		);

		Component.displayName = name;

		return { [ name ]: Component } as ComponentDefinition< Name, Props >;
	};
}

export function makeVoidComponent< Props >( )
: < Name extends string >( name: Name ) =>
	VoidComponentDefinition< Name, Props >
{
	return makeComponent< Props >( );
}
