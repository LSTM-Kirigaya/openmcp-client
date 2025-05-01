import type { TreeDataProvider, ExtensionContext } from 'vscode';

export interface CustomDescriptor<T> {
    configurable?: boolean;
    enumerable?: boolean;
    value?: T;
    writable?: boolean;
    get?(): any;
    set?(v: any): void;
}

export interface IRegisterCommandItem {
    handler: (context: ExtensionContext, ...args: any[]) => any;
    options?: any;
    target: any;
    propertyKey: string;
}

export type CommandHandlerDescriptor = CustomDescriptor<IRegisterCommandItem['handler']>;

export interface IRegisterTreeDataProviderItem<T> {
    providerConstructor: TreeDataProviderConstructor<T>;
    options?: any;
}

export type TreeDataProviderConstructor<T> = new (context: ExtensionContext, ...args: any[]) => TreeDataProvider<T>;