export function arrayify< T >( arr?: T[ ] | T | null | undefined | void ): T[ ]
{
	if ( arr == null )
		return [ ];
	return Array.isArray( arr ) ? arr : [ arr ];
}

export const performanceNow = ( ( ): ( ) => number =>
{
	if (
		typeof window !== 'undefined' &&
		typeof window?.performance?.now === 'function'
	)
		return ( ) => window.performance.now( );

	try
	{
		const perfHooks = require( 'perf_hooks' );
		if ( typeof perfHooks?.performance?.now === 'function' )
			return ( ) => perfHooks.performance.now( );
	}
	catch ( _err ) { }

	return ( ) => Date.now( );
} )( );
