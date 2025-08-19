export const DropdownMenu = ({ children }) => <div>{children}</div>;
export const DropdownMenuTrigger = ({ children, ...props }) => <div {...props}>{children}</div>;
export const DropdownMenuContent = ({ children, ...props }) => <div {...props}>{children}</div>;
export const DropdownMenuItem = ({ children, ...props }) => <div role="menuitem" tabIndex={0} {...props}>{children}</div>;
export const DropdownMenuSeparator = () => <hr />;
export const DropdownMenuCheckboxItem = ({ children }) => <div>{children}</div>;
