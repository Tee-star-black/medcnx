# Document Generation V2

MedCNX stores templates, logos, signatures and generated files through a private storage abstraction. Use `DOCUMENT_STORAGE_DRIVER=local` for development and `gcs` with `DOCUMENT_STORAGE_GCS_BUCKET` in Cloud Run. The bucket must not grant public access.

PDF output is produced on the API only by headless LibreOffice. The supplied API container installs LibreOffice Writer. Generation fails clearly when conversion is unavailable; it never substitutes HTML while claiming a PDF was generated.

DOCX templates use `{{scope.field}}`. Image fields are written as `{{organisation.logo}}` and `{{ceo.signature}}`; the backend converts these to protected image tags during rendering. Supported fields are listed by the template upload response. A template cannot be activated while unsupported placeholders remain.

## Simplified template management

Template management is organised into eight business groups: Employment, Confirmations, Leave, Policy & Compliance, Disciplinary, Payroll, Termination and General HR. Each group contains controlled document types. Presets are available only inside **Add template**, while the main library shows organisation templates and their immutable version history.

Role-specific employment contracts are retained as legacy resources but are no longer offered as presets. `MedCNX_Employment_Contract_Master.docx` is the single configurable employment contract for permanent, fixed-term, temporary, full-time and part-time arrangements. Its generation form provides controlled selections for contract type, work schedule, probation, notice period and professional council, with editable work location, reporting line, compliance and special conditions.

The default catalogue is installed automatically the first time an authorised administrator opens Template Management. Installation is idempotent: it adds only missing template names, validates and activates them, and never replaces an organisation's customised template. The catalogue includes the master employment contract, offer letter, confirmation of employment, salary confirmation, leave confirmation, policy acknowledgement, disciplinary-hearing notice, written warning, disciplinary outcome, certificate of service and resignation acknowledgement.

The files in `apps/api/resources/document-templates` are prepared copies of the user-supplied Word documents. Original wording is retained; supported employee/date fields are mapped. Bracketed practice-specific fields such as HPCSA/SANC numbers remain visible because those fields do not exist in the current Employee schema and must not be guessed.
