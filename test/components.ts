import { makeComponent } from '../lib'


export interface TreeItemProps
{
	title: string;
	description?: string;
}

export const { TreeItem } = makeComponent< TreeItemProps >( )( 'TreeItem' );
