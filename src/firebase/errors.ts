export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
  requestResourceData?: any;
};

export class FirestorePermissionError extends Error {
  public readonly context: SecurityRuleContext;

  constructor(context: SecurityRuleContext) {
    const message = `Firestore Permission Denied: Insufficient permissions for ${context.operation} on ${context.path}.`;
    super(message);
    this.name = 'FirestorePermissionError';
    this.context = context;

    // This is for V8 stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FirestorePermissionError);
    }
  }

  toContextObject() {
    // Explicitly mapping properties to ensure they are logged correctly
    // as standard Error properties are often non-enumerable.
    return {
      name: this.name,
      message: this.message,
      path: this.context.path,
      operation: this.context.operation,
      data: this.context.requestResourceData,
    };
  }
}
