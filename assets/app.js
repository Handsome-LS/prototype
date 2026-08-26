(function () {
  "use strict";

  var data = window.FINANCE_DATA;
  var pageEl = document.querySelector("[data-page]");
  var titleEl = document.querySelector("[data-title]");
  var crumbEl = document.querySelector("[data-crumb]");
  var drawer = document.querySelector("[data-drawer]");
  var drawerBody = document.querySelector("[data-drawer-body]");
  var drawerTitle = document.querySelector("[data-drawer-title]");
  var drawerKicker = document.querySelector("[data-drawer-kicker]");
  var backdrop = document.querySelector("[data-backdrop]");
  var modal = document.querySelector("[data-modal]");
  var modalBody = document.querySelector("[data-modal-body]");
  var modalTitle = document.querySelector("[data-modal-title]");
  var modalKicker = document.querySelector("[data-modal-kicker]");
  var modalBackdrop = document.querySelector("[data-modal-backdrop]");
  var toastEl = document.querySelector("[data-toast]");
  var helpTooltip = null;
  var activeHelp = null;
  var helpTooltipPinned = false;
  var initialOperationLogs = seedOperationLogs();

  var state = {
    page: "home",
    filters: { range: "本月", customStart: "2026-08-01", customEnd: "2026-08-14", customer: "all", supplier: "all", currency: "all", orderType: "all", sku: "all" },
    table: { q: "", page: 1, sort: "", dir: "asc" },
    pageFilters: {},
    base: { tab: "订单金额数据", includeVoid: false },
    reconcile: { tab: "全部", selectedBill: data.bills[0].id },
    logisticsRecon: { tab: "全部", selectedBill: data.logisticsBills[0].id },
    chartSeries: {
      finance: { income: true, cost: true, gross: true },
      exception: { amountDiff: true, platformMissing: true, unmatched: true, duplicate: true }
    },
    statementSnapshots: {},
    statementSequence: 0,
    importStep: 1,
    importFiles: { factory: null, logistics: null },
    importDrafts: { factory: defaultImportDraft("factory"), logistics: defaultImportDraft("logistics") },
    importMappings: { factory: defaultImportMapping("factory"), logistics: defaultImportMapping("logistics") },
    importTemplates: seedImportTemplates(),
    importTemplateSelection: { factory: "factory-a-standard", logistics: "usps-standard" },
    importProgress: { factory: 0, logistics: 0 },
    importProgressTimer: null,
    importAuditRequests: { factory: null, logistics: null },
    operationLogs: initialOperationLogs,
    operationLogSequence: initialOperationLogs.length,
    pendingSensitiveOperation: null,
    currentOperator: "王敏"
  };

  var pageNames = {
    home: "财务首页", baseData: "基础数据中心", income: "收入流水", consumption: "客户消耗流水", customerBills: "客户资金对账单", expense: "支出流水", bills: "工厂账单",
    reconcile: "对账工作台", settlement: "工厂结算", factoryCosts: "工厂成本",
    logisticsBills: "物流账单", logisticsReconcile: "物流成本对账", logisticsSettlement: "物流结算",
    profit: "订单利润", supplier: "工厂报表", logistics: "物流成本", logisticsReport: "物流报表", exceptions: "财务异常", operationLogs: "操作日志", config: "财务配置"
  };

  var FIELD_HELP = {
    "时间范围": "控制财务统计期间；不同指标需明确使用 occurred_at、imported_at、paid_at、bill_date 等业务时间。",
    "开始日期": "仅在时间范围选择自定义时生效。作为筛选起始日期，原型默认 2026-08-01，实际系统应按业务统计口径落到对应时间字段。",
    "结束日期": "仅在时间范围选择自定义时生效。作为筛选截止日期，原型默认 2026-08-14，实际系统通常按截止日 23:59:59 或后端约定的闭区间处理。",
    "客户": "来源：Order.customer_id / CustomerBalanceFlow.customer_id。用于收入、客户资金和订单利润筛选。",
    "工厂": "来源：PurchaseOrder.supplier_id / SupplierBill.supplier_id。用于采购单、工厂账单、对账、结算和工厂成本筛选；物流页面使用独立的物流商筛选。",
    "交易 / 账单币种": "非物流交易固定为 CNY；物流账单按原始币种筛选和分组，跨原币不得直接相加。",
    "币种": "非物流交易固定为 CNY；物流表格中的币种字段指账单原始币种，原币金额不可跨币种直接相加。",
    "原始币种": "物流商账单提供的费用币种。原币金额仅可在相同币种内汇总。",
    "记账汇率": "物流账单确认时保存的汇率快照，口径为 1 单位原币可兑换的人民币金额。",
    "人民币入账金额": "物流原币金额按记账汇率折算后的 CNY 金额，用于财务事件和订单毛利。",
    "订单类型": "来源：Order.order_type，区分正常单、售后单、补发单。",
    "SKU": "来源：OrderDetail / PurchaseOrder.sku，用于订单利润、对账、物流成本分析。",
    "客户业务收入": "订单扣款后生成的业务收入，不等于充值。来源：FinancialEvent 中客户收入类事件。",
    "基础数据中心": "财务对账的数据出口，集中查看和导出订单金额、SKU、采购单、代理商利润、取消退款和全链路金额。",
    "订单金额数据": "粒度：1 行 = 1 个订单。用于下载客户订单金额、净消耗、成本和利润状态。",
    "订单详情 / SKU 数据": "粒度：1 行 = 1 个订单详情。历史订单必须读取价格快照，不用当前 SKU 价格重算。",
    "采购单 / 工厂价格数据": "粒度：1 行 = 1 个采购单。财务核对以采购单工厂价快照为准。",
    "代理商价格与利润数据": "粒度：1 行 = 1 个代理商订单详情。外部代理商应得利润，内部代理商只记录绩效利润。",
    "取消 / 退款数据": "用于核对取消订单、退款、工厂成本和客户净消耗。",
    "全链路金额明细": "默认粒度：1 个订单详情 + 当前有效采购单，可扩展包含历史/作废采购单。",
    "客户类型": "普通客户 / 外部代理商 / 内部代理商。影响代理商利润是否实际支付。",
    "代理商": "客户为代理商时的代理商主体；普通客户为空或 --。",
    "订单状态": "订单当前业务状态；基础数据中心用于判断取消、退款、利润状态。",
    "是否取消": "订单是否取消。取消后需结合是否生产判断退款和工厂成本。",
    "是否退款": "订单是否已发生退款或收入冲销。",
    "产品总售价": "订单产品销售金额合计。",
    "应收运费": "客户应付物流费用收入。",
    "应付运费": "平台预计或实际应付物流成本。",
    "应收设计费": "客户设计费收入。",
    "应付设计费": "设计服务成本或应付项，原型按设计费成本模拟。",
    "预上网费": "预上网服务费，作为客户应付的一部分。",
    "其他服务费": "除产品、物流、设计、预上网外的客户服务费。",
    "客户应付总金额": "产品总售价 + 应收运费 + 应收设计费 + 预上网费 + 其他服务费。",
    "实际扣款金额": "客户余额流水中实际扣款合计。",
    "已退款金额": "退款流水或收入冲销金额。",
    "客户净消耗": "实际扣款金额 - 已退款金额。",
    "当前毛利": "客户净消耗 - 工厂成本 - 物流成本 - 售后成本。",
    "利润状态": "暂估/最终/取消已退款/取消不退款等利润口径状态。",
    "SKU 名称": "商品名称，原型按 SKU 生成示例。",
    "SKU 属性": "颜色、尺码等订单详情属性。",
    "平台 SKU 标准对客价": "平台标准零售价。",
    "平台 SKU 对客价": "平台 SKU 对终端客户的价格快照，历史订单需使用下单时快照。",
    "订单实际成交单价": "订单创建时成交价快照。",
    "实际订单成交单价": "订单创建时成交价快照，用于代理商利润核对。",
    "实际成交单价": "订单创建时成交价快照，用于全链路金额核对。",
    "代理商价格": "平台给代理商的成本价或代理价。",
    "平台给代理商的代理商价格": "平台给代理商的成本价或代理价，是代理商利润计算的扣减项。",
    "代理商价": "平台给代理商的成本价或代理价，是代理商利润计算的扣减项。",
    "代理商对客价": "代理商设置给终端客户的价格。",
    "代理商设置的对客价格": "代理商在订单中设置给终端客户的销售价格。",
    "单件代理商利润": "代理商对客价 - 代理商价格。",
    "代理商利润合计": "单件代理商利润 × 数量。",
    "代理商应得利润": "外部代理商等于利润合计；内部代理商为 0。",
    "内部绩效利润记录值": "内部代理商不实际支付，但记录为绩效/提成参考。",
    "是否需要实际支付代理商利润": "外部代理商为是，内部代理商为否。",
    "本详情产品销售金额": "订单详情成交单价 × 数量。",
    "已分配工厂数": "该订单详情被分配到的工厂数量。",
    "当前有效工厂": "当前有效采购单对应工厂。",
    "当前有效采购单": "当前未作废且有效的采购单。",
    "当前工厂单价": "SKU 当前工厂报价，仅参考。",
    "当前采购金额": "当前有效采购单金额。",
    "采购金额": "采购单工厂价快照 × 数量，财务核对以快照金额为准。",
    "是否生产": "采购单是否已进入生产或已完成生产。",
    "是否发货": "采购单是否已发货。",
    "采购单 ID": "PurchaseOrder.id。",
    "采购单号": "PurchaseOrder.po_no。",
    "SKU 当前工厂价": "当前 SKU 工厂报价，仅作为参考。",
    "采购单工厂价快照": "采购单创建时记录的历史工厂价，财务核对以此为准。",
    "采购单总金额": "采购单工厂价快照 × 数量。",
    "采购单类型": "正常采购单、外部补录采购单等。",
    "采购单状态": "采购单当前履约状态。",
    "是否作废": "采购单是否已作废。默认基础表不包含作废，开启后展示历史/作废采购单。",
    "是否外部补录": "平台缺单处理创建的外部补录采购单。",
    "创建时间": "记录创建时间，不应替代业务发生时间。",
    "下发时间": "采购单下发给工厂时间。",
    "接单时间": "工厂确认接单时间。",
    "生产时间": "工厂生产完成或进入生产的时间。",
    "发货时间": "工厂或物流发货时间。",
    "是否已产生工厂成本": "是否已生成 FACTORY_COST 财务事件。",
    "工厂成本金额": "工厂成本金额，第一版来自采购单系统金额。",
    "取消时间": "订单取消发生时间。",
    "取消原因": "订单取消原因，用于判断退款和成本归属。",
    "取消时状态": "取消发生时订单/采购单所处阶段。",
    "是否已经生产": "取消时工厂是否已经生产，决定是否退款和是否产生工厂成本。",
    "原客户支付金额": "取消前客户实际支付/扣款金额。",
    "应退款金额": "未生产取消通常等于客户实际扣款；已生产取消可为 0。",
    "实际退款金额": "实际已退回金额。",
    "是否完成退款": "退款流程是否完成。",
    "原采购单数量": "取消前关联采购单数量。",
    "已取消采购单数量": "取消后已作废采购单数量。",
    "已生产采购单数量": "取消时已生产的采购单数量。",
    "当前客户净消耗": "取消/退款后客户仍实际消耗金额。",
    "当前订单净收入": "取消/退款后的订单净收入。",
    "当前订单成本": "取消/退款后仍需承担的工厂、物流等成本。",
    "客户应付金额": "产品总售价 + 应收运费 + 应收设计费 + 预上网费 + 其他服务费。",
    "实际扣款": "客户余额流水中针对该订单实际扣减的金额。",
    "已退款": "退款流水或收入冲销金额。",
    "净消耗": "实际扣款 - 已退款。",
    "工厂单价快照": "采购单创建时记录的历史工厂价，财务核对以此为准。",
    "物流成本差额": "实际物流成本 - 预估物流成本。",
    "代理商利润": "代理商对客价与代理商价之间的差额按数量汇总。",
    "异常状态": "取消、退款、成本之间是否存在异常。",
    "包含历史/作废采购单": "开启后全链路金额明细会展开同一订单详情历史上产生的多张采购单。",
    "工厂成本": "来源：采购单系统报价快照 / FinancialEvent。第一版以系统采购单金额作为工厂最终应付依据。",
    "物流成本": "无实际账单时使用人民币预估成本；有物流商实际账单后使用折算人民币实际成本，并保留暂估/最终状态。",
    "售后成本": "平台承担的售后工厂成本和售后物流成本；补发单自身独立计算利润。",
    "订单毛利": "净收入 - 工厂成本 - 物流成本 - 售后成本。订单利润页按订单维度展示。",
    "毛利率": "毛利 / 净收入。净收入为 0 时应显示 -- 或特殊状态。",
    "待导入/待处理账单": "当前处于待导入、待处理或异常状态的工厂/物流账单数量。",
    "待对账采购单": "已发货且尚未完成对账的采购单，只统计已进入应付范围的数据。",
    "金额差异条数": "工厂账单金额与系统采购单金额不一致的明细数。",
    "平台缺单条数": "工厂账单存在但系统无对应采购单，需人工关联订单详情并创建外部补录采购单。",
    "待结算金额": "Settlement 中 payable_amount - paid_amount，固定按 CNY 展示。",
    "已逾期待办": "对账、账单、结算等事项超过 SLA 的数量，SLA 建议来自监控配置。",
    "查询起点余额": "所选查询开始时间前的客户余额。按客户和 CNY 读取最近余额快照，再累计快照后、查询起点前的有效资金变动；不依赖账期。",
    "查询结束余额": "查询起点余额加上所选时间范围内的有效资金净变动。",
    "期间充值": "所选查询范围内 RECHARGE 有效入账合计。",
    "期间订单消耗": "所选查询范围内 ORDER_CONSUMPTION 有效扣款合计。",
    "期间退款返还": "所选查询范围内 ORDER_REFUND 有效返还合计。",
    "期间人工调增": "所选查询范围内 MANUAL_CREDIT 有效入账合计，需审计备注。",
    "期间人工调减": "所选查询范围内 MANUAL_DEBIT 有效扣减合计，需审计备注。",
    "消耗订单数": "存在有效 order_id 的去重订单数量。",
    "消耗异常数": "资金流水、订单支付状态、收入事件三方一致性检查异常数量。",
    "收入事件号": "FinancialEvent.event_no，业务收入、退款或调整事件的唯一追溯号；不是客户资金流水号。",
    "支出事件号": "FinancialEvent.event_no，工厂、物流、售后等成本事件的唯一追溯号；不是银行流水号、付款单号或客户资金流水号。",
    "资金流水号": "CustomerBalanceFlow.flow_no，客户资金变动唯一追溯号。",
    "发生时间": "资金或财务事件发生时间，需与统计口径字段一致。",
    "流水类型": "RECHARGE / ORDER_CONSUMPTION / ORDER_REFUND / MANUAL_CREDIT / MANUAL_DEBIT。",
    "变动方向": "收入表示余额增加，支出表示余额减少。",
    "变动金额": "本次余额变化金额，始终带币种。",
    "变动前余额": "流水发生前客户余额。",
    "变动后余额": "流水发生后客户余额。",
    "订单号": "Order.order_no；非订单流水可为空，ORDER_CONSUMPTION 为空必须标记异常。",
    "平台订单号": "外部平台订单号，辅助客户对账和账单导出。",
    "订单应付金额": "订单费用项合计：产品、物流、设计、服务、其他等。",
    "本次订单消耗金额": "本次 ORDER_CONSUMPTION 实际扣减金额。",
    "关联原流水号": "退款/冲销指向原扣款流水。",
    "资金状态": "CustomerBalanceFlow 状态，如已完成、失败、冲销。",
    "订单支付状态": "Order.payment_status，用于和资金流水核对。",
    "收入事件状态": "FinancialEvent 是否完整、缺失或金额差异；退款流水显示“退款已生效”，表示对应负向收入事件已经入账。",
    "一致性状态": "订单应付金额、有效扣款合计、收入事件合计三方校验结果。",
    "来源": "资金或成本来源，如订单扣款、客户充值、采购单系统报价、物流账单。",
    "操作人": "系统或人工操作人，关键财务动作必须进入审计日志。",
    "备注": "异常、调账或人工处理说明；调账类建议必填。",
    "客户消耗流水": "完整展示客户充值、订单消耗、退款、调账等余额流转过程。",
    "客户资金对账单": "按当前客户、币种和时间范围实时汇总 CustomerBalanceFlow；需要留档时可生成不可变快照。",
    "查询期间": "由当前全局时间筛选确定，不依赖预先配置的客户账期。",
    "充值金额": "查询期间客户充值合计。",
    "订单消耗金额": "查询期间客户订单扣款合计。",
    "退款返还金额": "查询期间退款返还余额合计。",
    "其他调增": "非订单原因导致余额增加的人工或系统调账。",
    "其他调减": "非订单原因导致余额减少的人工或系统调账。",
    "资金流水数": "查询期间的资金流水行数。",
    "异常流水数": "查询期间一致性异常的资金流水数。",
    "数据状态": "实时查询随当前筛选重新计算；已生成快照表示结果已按当时范围留档。",
    "查询/生成时间": "实时查询随筛选更新；快照显示实际生成时间。",
    "对账明细序号": "当前对账范围内的明细行号，仅用于页面展示和导出。",
    "订单详情摘要": "OrderDetail 的 SKU、数量等摘要。",
    "费用构成": "CustomerConsumptionItem 费用拆分：产品/物流/设计/服务/其他。",
    "本次消耗/返还金额": "客户资金对账明细中的本次余额影响金额。",
    "余额变动方向": "客户账单明细中余额增加或减少。",
    "收入事件合计": "该订单对应客户收入类 FinancialEvent 合计。",
    "订单关联状态": "资金流水是否正确关联到订单。ORDER_CONSUMPTION 无订单应为严重异常。",
    "流水号": "财务或资金流水唯一编号，用于追溯。",
    "收入类型": "产品收入、物流收入、设计费收入、服务费收入、客户退款、手工调整。",
    "原始金额": "未扣减退款/冲销前的金额。",
    "退款/冲销": "退款或冲销金额，收入净额需扣减。",
    "净金额": "原始金额 - 退款/冲销；收入趋势使用净额。",
    "来源单据": "触发财务事件的业务单据，如扣款流水、退款单、采购单、物流账单。",
    "状态": "当前业务状态，具体枚举见字段说明文档。",
    "订单详情": "OrderDetail ID 或摘要，用于追溯订单明细。",
    "支出类型": "工厂成本、物流成本、售后成本、冲销或手工调整。",
    "成本方类型": "支出事件的交易对方类型，第一版区分工厂和物流商。",
    "成本方": "支出事件对应的工厂或物流商，由 counterparty_type + counterparty_id 确定。",
    "关联订单号": "成本最终归属的 Order.order_no；工厂和物流成本都必须可追溯到订单。",
    "关联采购单号": "仅工厂成本适用，对应 PurchaseOrder.po_no；物流成本不得填写采购单。",
    "业务关联单据": "工厂成本关联采购单，物流成本直接关联订单；成本来源仍可追溯面单或物流账单明细。",
    "系统金额": "FinancialEvent 生效的人民币成本金额。工厂成本来自采购单，物流成本来自人民币预估或账单折算金额。",
    "对账状态": "采购单或账单是否完成对账。",
    "结算状态": "Settlement 当前付款阶段。",
    "外部补录": "仅工厂成本适用，表示是否由平台缺单处理创建外部补录采购单；物流成本显示不适用。",
    "账单 ID": "工厂账单或物流账单在系统中的唯一 ID。",
    "工厂账单号": "工厂提供的原始账单编号，对应 SupplierBill.bill_no；导入账单时从文件读取或由财务填写，不同于平台生成的账单 ID。",
    "账期": "账单覆盖的业务时间范围，工厂账期不固定，导入时填写。",
    "总条数": "账单明细总行数。",
    "总金额": "工厂账单原始总金额。",
    "自动匹配": "系统按采购单 ID、订单号+SKU 等规则自动匹配成功的行数。",
    "未匹配": "系统无法找到唯一业务对象的账单行。",
    "重复": "按工厂稳定唯一键或组合规则识别的重复行。",
    "已确认": "财务已确认处理结果的明细数。",
    "系统应付": "系统采购单金额汇总，第一版作为最终应付依据。",
    "系统应付金额": "平台应付工厂金额，通常来自 PurchaseOrder.system_amount 或 Settlement.payable_amount。",
    "账单金额": "工厂或物流商账单侧金额。",
    "差异金额": "账单金额 - 系统金额。",
    "匹配方式": "系统如何匹配账单与业务对象，如 PO_ID、ORDER_SKU、TRACKING。",
    "匹配依据": "展示唯一命中的字段组合、多候选数量或人工处理原因；没有明确评分公式时不显示百分比。",
    "审核说明": "财务人工处理差异时填写的说明。",
    "结算单号": "Settlement.settlement_no，工厂付款追溯号。",
    "物流结算单号": "LogisticsSettlement.settlement_no，物流付款追溯号；一张有效物流账单最多一张有效结算单。",
    "物流账单": "物流商 + 原始币种维度的账单；物流结算和物流成本筛选均以 LogisticsBill.id 关联。",
    "物流账单 ID": "LogisticsBill.id，用于从物流账单追溯对应成本明细和结算单。",
    "工厂账单 ID": "SupplierBill.id，用于从工厂成本追溯账单和对账结果。",
    "对账确认金额": "已确认物流账单明细的原币实际费用合计，是物流结算的系统应付快照。",
    "原币最终应付": "原币对账确认金额 + 原币增加金额 - 原币减少金额。",
    "人民币折算金额": "原币最终应付按物流账单不可变记账汇率快照折算的 CNY 金额。",
    "已付金额": "已完成付款金额。",
    "未付金额": "payable_amount - paid_amount。",
    "付款时间": "Settlement.paid_at；未付款显示为空或 --。",
    "产品收入": "订单产品费用形成的客户收入。",
    "物流收入": "客户向平台支付的物流费用收入，不等同于物流成本。",
    "设计费": "客户设计服务收入。",
    "服务费": "客户服务费收入。",
    "退款": "退还给客户或冲销收入的金额。",
    "净收入": "产品收入 + 物流收入 + 设计费 + 服务费 - 退款。",
    "原始毛利": "净收入 - 工厂成本 - 物流成本，不含售后成本。",
    "含售后毛利": "原始毛利 - 售后成本，更接近真实经营结果。",
    "对账完成度": "订单相关采购单和成本对账完成状态。",
    "物流商": "物流渠道或承运商，例如 USPS、UPS、FedEx、DHL。",
    "物流账单号": "物流商提供的账单编号。",
    "账单总金额": "物流商账单原始总金额。",
    "成本偏差异常": "实际物流成本与系统预估成本偏差超过阈值的行数。",
    "系统预估总成本": "系统面单/报价表计算的预估物流成本合计。",
    "实际账单总成本": "物流商实际账单确认成本合计。",
    "总成本差额": "实际账单总成本 - 系统预估总成本。",
    "Tracking Number": "物流轨迹号，物流账单匹配的优先字段。",
    "面单号": "ShippingLabel.label_no，物流面单标识。",
    "系统预估成本": "系统物流报价表计算结果。",
    "实际账单成本": "物流商账单实际总费用。",
    "差额": "实际成本 - 预估成本。",
    "偏差率": "差额 / 系统预估成本；预估为 0 时显示 --。",
    "预估重量": "系统下单或报价时使用的重量。",
    "实际重量": "物流商账单回传的实际重量，可为空。",
    "计费重量": "物流商用于计费的重量，可能是实际重或体积重。",
    "异常等级": "按偏差率阈值和绝对差额阈值共同判定。",
    "匹配状态": "物流或工厂账单明细的匹配结果。",
    "客户物流费用": "客户支付给平台的物流费用收入。",
    "预估物流成本": "系统预估物流履约成本。",
    "实际物流成本": "物流商实际账单成本；未到账时可为空或暂估。",
    "成本差额": "实际物流成本 - 预估物流成本。",
    "实际账单状态": "是否已匹配到物流商实际账单。",
    "异常类型": "财务异常分类，如账单金额差异、平台缺单、物流成本严重偏差。",
    "负责人": "异常当前处理人。",
    "最后更新": "异常或任务最后更新时间。",
    "日志编号": "操作日志不可变唯一编号，用于审计追溯。",
    "操作分类": "区分导出、账单导入、对账处理、结算操作、付款操作、快照和配置变更。",
    "操作名称": "用户实际执行的命令名称，同一分类下可包含多种具体操作。",
    "业务对象": "本次操作直接影响或导出的数据集、账单、结算单、对账明细或客户对账单。",
    "关键记录值": "根据操作类型展示关键值摘要；完整的操作前后值在详情中查看。",
    "操作人": "执行操作的登录用户；后端应同时记录用户 ID 与显示名称。",
    "执行结果": "操作请求的最终结果或当前任务状态，如成功、处理中、失败。",
    "请求编号": "一次后端请求的链路编号，用于关联接口日志、导出任务和异步任务。"
  };

  function init() {
    fillSelect("customer", data.customers);
    fillSelect("supplier", data.suppliers);
    fillSelect("sku", data.skus);
    bindShell();
    updateRealtimeTime();
    window.setInterval(updateRealtimeTime, 1000);
    initHelpTooltip();
    enhanceHelp(document);
    enhanceSelects(document);
    render();
  }

  function fillSelect(name, values) {
    var select = document.querySelector('[data-filter="' + name + '"]');
    if (!select) return;
    values.forEach(function (value) {
      var option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
  }

  function bindShell() {
    document.querySelectorAll("[data-nav]").forEach(function (button) {
      button.addEventListener("click", function () { navigate(button.dataset.nav); });
    });
    document.querySelectorAll(".nav-group").forEach(function (group) {
      syncNavDisclosure(group);
      group.addEventListener("toggle", function () {
        syncNavDisclosure(group);
        if (!group.open) return;
        document.querySelectorAll(".nav-group").forEach(function (item) {
          if (item !== group) item.open = false;
          syncNavDisclosure(item);
        });
      });
    });
    document.querySelectorAll("[data-filter]").forEach(function (el) {
      el.addEventListener("change", function () {
        state.filters[el.dataset.filter] = el.value;
        if (el.dataset.filter === "range") syncCustomDateFields();
        state.table.page = 1;
        render();
      });
    });
    document.querySelector("[data-reset]").addEventListener("click", function () {
      state.filters = { range: "本月", customStart: "2026-08-01", customEnd: "2026-08-14", customer: "all", supplier: "all", currency: "all", orderType: "all", sku: "all" };
      document.querySelectorAll("[data-filter]").forEach(function (el) { el.value = state.filters[el.dataset.filter]; });
      syncCustomDateFields();
      document.querySelectorAll("select").forEach(syncSearchSelect);
      render();
    });
    document.querySelector("[data-refresh]").addEventListener("click", function () {
      updateLastUpdatedTime();
      toast("已刷新财务 Mock 数据视图");
    });
    document.querySelector("[data-close]").addEventListener("click", closeDrawer);
    backdrop.addEventListener("click", closeDrawer);
    document.querySelector("[data-close-modal]").addEventListener("click", closeModal);
    modalBackdrop.addEventListener("click", closeModal);
    document.addEventListener("click", handleClick);
    document.addEventListener("click", function (event) {
      if (event.target.closest(".search-select")) return;
      document.querySelectorAll(".search-select.is-open").forEach(closeSearchSelect);
    });
    document.addEventListener("input", handleInput);
    document.addEventListener("change", handleChange);
    syncCustomDateFields();
  }

  function formatClockTime(date) {
    return [date.getHours(), date.getMinutes(), date.getSeconds()].map(function (value) {
      return String(value).padStart(2, "0");
    }).join(":");
  }

  function updateRealtimeTime() {
    document.querySelector("[data-realtime]").textContent = formatClockTime(new Date());
  }

  function updateLastUpdatedTime() {
    document.querySelector("[data-updated]").textContent = formatClockTime(new Date());
  }

  function navigate(page) {
    closeDrawer();
    closeModal();
    state.page = page;
    var pageFilters = arguments.length > 1 ? arguments[1] : null;
    state.table.page = 1;
    state.table.q = "";
    state.pageFilters = pageFilters || {};
    document.querySelectorAll("[data-nav]").forEach(function (item) {
      var active = item.dataset.nav === page;
      item.classList.toggle("is-active", active);
      if (active) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
    var activeNav = document.querySelector('[data-nav="' + page + '"]');
    if (activeNav) {
      var group = activeNav.closest(".nav-group");
      document.querySelectorAll(".nav-group").forEach(function (item) {
        item.open = item === group;
        syncNavDisclosure(item);
      });
    }
    pageEl.classList.remove("is-changing");
    void pageEl.offsetWidth;
    pageEl.classList.add("is-changing");
    render();
  }

  function syncNavDisclosure(group) {
    var summary = group.querySelector("summary");
    if (summary) summary.setAttribute("aria-expanded", group.open ? "true" : "false");
  }

  function render() {
    hideHelpTooltip();
    titleEl.textContent = pageNames[state.page];
    crumbEl.textContent = pageNames[state.page];
    syncPageFilterVisibility();
    renderActiveFilters();
    updateBadges();
    if (state.page === "home") renderHome();
    if (state.page === "baseData") renderBaseData();
    if (state.page === "income") renderIncome();
    if (state.page === "consumption") renderConsumption();
    if (state.page === "customerBills") renderCustomerStatements();
    if (state.page === "expense") renderExpense();
    if (state.page === "bills") renderBills();
    if (state.page === "reconcile") renderReconcile();
    if (state.page === "settlement") renderSettlement();
    if (state.page === "factoryCosts") renderFactoryCosts();
    if (state.page === "logisticsBills") renderLogisticsBills();
    if (state.page === "logisticsReconcile") renderLogisticsReconcile();
    if (state.page === "logisticsSettlement") renderLogisticsSettlement();
    if (state.page === "profit") renderProfit();
    if (state.page === "supplier") renderSupplier();
    if (state.page === "logistics") renderLogistics();
    if (state.page === "logisticsReport") renderLogisticsReport();
    if (state.page === "exceptions") renderExceptions();
    if (state.page === "operationLogs") renderOperationLogs();
    if (state.page === "config") renderConfig();
    if (state.page !== "operationLogs") pageEl.insertAdjacentHTML("afterbegin", currencyPolicy(["logisticsBills", "logisticsReconcile", "logisticsSettlement", "logistics", "logisticsReport"].indexOf(state.page) >= 0));
    enhanceHelp(pageEl);
    enhanceSelects(pageEl);
  }

  function syncPageFilterVisibility() {
    var operationLogPage = state.page === "operationLogs";
    document.querySelectorAll("[data-filter]").forEach(function (control) {
      var field = control.dataset.filter;
      var label = control.closest("label");
      if (!label) return;
      var operationLogField = ["range", "customStart", "customEnd"].indexOf(field) >= 0;
      label.hidden = operationLogPage && !operationLogField;
    });
    syncCustomDateFields();
  }

  function renderActiveFilters() {
    var row = document.querySelector("[data-active-filters]");
    var labels = { range: "时间", customer: "客户", supplier: "工厂", currency: "交易/账单币种", orderType: "订单类型", sku: "SKU" };
    var filterKeys = state.page === "operationLogs" ? ["range"] : Object.keys(labels);
    var chips = filterKeys.filter(function (k) { return state.filters[k] !== "all" && state.filters[k] !== "本月"; }).map(function (k) {
      var value = state.filters[k];
      if (k === "range" && value === "自定义") value = formatCustomRange();
      return '<span class="chip">' + labels[k] + "：" + esc(value) + "</span>";
    });
    row.hidden = chips.length === 0;
    row.innerHTML = chips.join("");
  }

  function syncCustomDateFields() {
    var custom = state.filters.range === "自定义";
    document.querySelectorAll("[data-custom-date]").forEach(function (el) {
      el.hidden = !custom;
    });
  }

  function formatCustomRange() {
    var start = state.filters.customStart || "未设置开始";
    var end = state.filters.customEnd || "未设置结束";
    return start + " 至 " + end;
  }

  function parseDateOnly(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
    if (!match) return null;
    var date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3])) return null;
    return date;
  }

  function addDays(date, days) {
    var result = new Date(date.getTime());
    result.setDate(result.getDate() + days);
    return result;
  }

  function dateBoundary(date) {
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0") + " 00:00";
  }

  function consumptionQueryRange() {
    var reference = parseDateOnly(data.asOfDate) || new Date();
    reference.setHours(0, 0, 0, 0);
    var start;
    var end;
    if (state.filters.range === "今日") {
      start = reference;
      end = addDays(start, 1);
    } else if (state.filters.range === "本周") {
      var weekday = reference.getDay() || 7;
      start = addDays(reference, 1 - weekday);
      end = addDays(start, 7);
    } else if (state.filters.range === "上月") {
      start = new Date(reference.getFullYear(), reference.getMonth() - 1, 1);
      end = new Date(reference.getFullYear(), reference.getMonth(), 1);
    } else if (state.filters.range === "自定义") {
      start = parseDateOnly(state.filters.customStart);
      var customEnd = parseDateOnly(state.filters.customEnd);
      if (!start || !customEnd || start.getTime() > customEnd.getTime()) return { valid: false };
      end = addDays(customEnd, 1);
    } else {
      start = new Date(reference.getFullYear(), reference.getMonth(), 1);
      end = new Date(reference.getFullYear(), reference.getMonth() + 1, 1);
    }
    return { valid: true, startAt: dateBoundary(start), endAt: dateBoundary(end) };
  }

  function customerFlowMatchesAccountScope(row) {
    if (state.filters.customer !== "all" && row.customer !== state.filters.customer) return false;
    if (state.filters.currency !== "all" && row.currency !== state.filters.currency) return false;
    return true;
  }

  function customerFlowInRange(row, range) {
    return range.valid && row.occurred >= range.startAt && row.occurred < range.endAt;
  }

  function isEffectiveCustomerFlow(row) {
    return row.fundStatus === "已完成";
  }

  function signedCustomerFlowAmount(row) {
    return row.direction === "收入" ? row.amount : -row.amount;
  }

  function scopedCustomerAccounts() {
    var accounts = {};
    function addAccount(row) {
      var key = row.customer + "::" + row.currency;
      accounts[key] = { customer: row.customer, currency: row.currency };
    }
    (data.customerBalanceSnapshots || []).filter(customerFlowMatchesAccountScope).forEach(addAccount);
    data.customerFlows.filter(customerFlowMatchesAccountScope).forEach(addAccount);
    return Object.keys(accounts).map(function (key) { return accounts[key]; }).sort(function (a, b) {
      return a.customer.localeCompare(b.customer) || a.currency.localeCompare(b.currency);
    });
  }

  function customerAccountOpeningBalance(range, customer, currency) {
    if (!range.valid) return { available: false, value: 0 };
    var accountSnapshots = (data.customerBalanceSnapshots || []).filter(function (snapshot) {
      return snapshot.customer === customer && snapshot.currency === currency && snapshot.snapshotAt <= range.startAt;
    }).sort(function (a, b) { return b.snapshotAt.localeCompare(a.snapshotAt); });
    if (!accountSnapshots.length) return { available: false, value: 0 };
    var snapshot = accountSnapshots[0];
    var balance = snapshot.balance;
    data.customerFlows.forEach(function (flow) {
      if (flow.customer !== customer || flow.currency !== currency || !isEffectiveCustomerFlow(flow)) return;
      if (flow.occurred >= snapshot.snapshotAt && flow.occurred < range.startAt) balance = round(balance + signedCustomerFlowAmount(flow));
    });
    return { available: true, value: balance };
  }

  function consumptionOpeningBalance(range) {
    if (!range.valid) return { available: false, value: 0 };
    var accounts = scopedCustomerAccounts();
    var opening = 0;
    if (!accounts.length) return { available: false, value: 0 };
    for (var i = 0; i < accounts.length; i += 1) {
      var accountOpening = customerAccountOpeningBalance(range, accounts[i].customer, accounts[i].currency);
      if (!accountOpening.available) return { available: false, value: 0 };
      opening = round(opening + accountOpening.value);
    }
    return { available: true, value: opening };
  }

  function statementKey(customer, currency, range) {
    return [customer, currency, range.startAt, range.endAt].join("::");
  }

  function statementPeriod(range) {
    if (!range.valid) return "—";
    var exclusiveEnd = parseDateOnly(range.endAt.slice(0, 10));
    var inclusiveEnd = exclusiveEnd ? addDays(exclusiveEnd, -1) : null;
    return range.startAt.slice(0, 10) + " ~ " + (inclusiveEnd ? dateBoundary(inclusiveEnd).slice(0, 10) : range.endAt.slice(0, 10));
  }

  function currentDateTime() {
    var now = new Date();
    return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0") + " " + String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
  }

  function operationValue(field, before, after) {
    return { field: field, before: before == null || before === "" ? "—" : String(before), after: after == null || after === "" ? "—" : String(after) };
  }

  function seedOperationLogs() {
    var seeds = [
      { category: "导出", action: "导出基础数据", targetType: "基础数据集", targetId: "全链路金额明细", summary: "当前筛选结果 / XLSX / 36 行", values: [operationValue("导出格式", "—", "XLSX"), operationValue("导出范围", "—", "当前筛选结果"), operationValue("筛选条件", "—", "本月；币种=CNY"), operationValue("导出行数", "—", "36")], operator: "王敏" },
      { category: "账单导入", action: "导入工厂账单", targetType: "工厂账单", targetId: "SUP-BILL-20260831", summary: "Factory A / 2026-08-01 ~ 2026-08-10", values: [operationValue("工厂", "—", "Factory A"), operationValue("工厂账单号", "—", "SUP-BILL-20260831"), operationValue("账期", "—", "2026-08-01 ~ 2026-08-10"), operationValue("上传文件", "—", "factory-a-202608.xlsx")], operator: "王敏" },
      { category: "对账处理", action: "按系统金额确认", targetType: "工厂对账明细", targetId: "FB-202608-0001 / Line 12", summary: "待处理 → 已确认；系统金额 128.00 CNY", values: [operationValue("操作前状态", "待处理", "已确认"), operationValue("确认口径", "工厂账单 136.00 CNY", "系统金额 128.00 CNY"), operationValue("处理备注", "—", "以系统采购单金额为准")], operator: "陈露" },
      { category: "结算操作", action: "生成工厂结算单", targetType: "工厂结算单", targetId: "SET-202608-0012", summary: "系统应付 420.00 CNY；最终应付 425.00 CNY", values: [operationValue("系统应付金额", "—", "420.00 CNY"), operationValue("增加金额", "—", "5.00 CNY"), operationValue("减少金额", "—", "0.00 CNY"), operationValue("最终应付金额", "—", "425.00 CNY")], operator: "王敏" },
      { category: "付款操作", action: "标记工厂结算单付款", targetType: "工厂结算单", targetId: "SET-202608-0011", summary: "付款金额 318.00 CNY；待付款 → 已付款", values: [operationValue("付款金额", "—", "318.00 CNY"), operationValue("操作前状态", "待付款", "已付款"), operationValue("付款备注", "—", "银行转账 202608170021")], operator: "李哲" },
      { category: "快照", action: "生成客户资金对账快照", targetType: "客户资金对账单", targetId: "CSTAT-20260817-0001", summary: "Customer A / 2026-08-01 ~ 2026-08-14", values: [operationValue("客户", "—", "Customer A"), operationValue("查询期间", "—", "2026-08-01 ~ 2026-08-14"), operationValue("资金流水数", "—", "18"), operationValue("查询结束余额", "—", "1,286.00 CNY")], operator: "王敏" },
      { category: "配置变更", action: "保存工厂字段映射模板", targetType: "字段映射模板", targetId: "Factory A 账单模板", summary: "Factory A / 8 个映射字段", values: [operationValue("适用主体", "—", "Factory A"), operationValue("模板名称", "—", "Factory A 账单模板"), operationValue("模板版本", "v1", "v2"), operationValue("映射字段数", "7", "8")], operator: "王敏" },
      { category: "异常处理", action: "确认异常处理结果", targetType: "财务异常", targetId: "FIN-EXC-20260813-0003", summary: "处理中 → 已解决", values: [operationValue("操作前状态", "处理中", "已解决"), operationValue("处理备注", "—", "已核对采购单和工厂账单")], operator: "周航" }
    ];
    return seeds.map(function (entry, index) {
      return Object.freeze({
        id: "OPLOG-20260817-" + String(index + 1).padStart(4, "0"),
        occurredAt: "2026-08-17 " + String(9 + index).padStart(2, "0") + ":" + String((index * 7) % 60).padStart(2, "0"),
        category: entry.category,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        summary: entry.summary,
        values: Object.freeze(entry.values.map(function (value) { return Object.freeze(value); })),
        operator: entry.operator,
        result: "成功",
        requestId: "REQ-20260817-" + String(3101 + index),
        sourceIp: "10.20.8." + String(21 + index)
      });
    }).reverse();
  }

  function recordOperationLog(entry) {
    state.operationLogSequence += 1;
    var timestamp = currentDateTime();
    var datePart = timestamp.slice(0, 10).replace(/-/g, "");
    var values = (entry.values || []).map(function (value) {
      return Object.freeze(operationValue(value.field, value.before, value.after));
    });
    var log = Object.freeze({
      id: "OPLOG-" + datePart + "-" + String(state.operationLogSequence).padStart(4, "0"),
      occurredAt: timestamp,
      category: entry.category || "敏感操作",
      action: entry.action || "未命名操作",
      targetType: entry.targetType || "财务对象",
      targetId: entry.targetId || "—",
      summary: entry.summary || operationLogValueSummary(values),
      values: Object.freeze(values),
      operator: state.currentOperator,
      result: entry.result || "成功",
      requestId: entry.requestId || "REQ-" + datePart + "-" + String(8000 + state.operationLogSequence),
      sourceIp: entry.sourceIp || "10.20.8.26"
    });
    state.operationLogs.unshift(log);
    return log;
  }

  function operationLogValueSummary(values) {
    return (values || []).slice(0, 3).map(function (value) {
      return value.before !== "—" && value.before !== value.after ? value.field + " " + value.before + " → " + value.after : value.field + " " + value.after;
    }).join("；") || "无业务值变更";
  }

  function operationFilterSummary() {
    var parts = ["时间=" + (state.filters.range === "自定义" ? formatCustomRange() : state.filters.range)];
    [["客户", state.filters.customer], ["工厂", state.filters.supplier], ["币种", state.filters.currency], ["订单类型", state.filters.orderType], ["SKU", state.filters.sku]].forEach(function (item) {
      if (item[1] !== "all") parts.push(item[0] + "=" + item[1]);
    });
    if (state.table.q) parts.push("关键词=" + state.table.q);
    return parts.join("；");
  }

  function recordExportOperation(options) {
    var formatSelect = pageEl.querySelector("[data-export-format]");
    var format = options.format || (formatSelect ? formatSelect.value : "XLSX");
    var selectedFields = options.fields || Array.prototype.map.call(pageEl.querySelectorAll(".field-picker input:checked"), function (input) {
      var label = input.closest("label");
      var fieldLabel = label ? label.querySelector("span") : null;
      return fieldLabel ? fieldLabel.textContent.replace(/^\d+\s+/, "") : "";
    }).filter(Boolean);
    var exportTaskId = "EXPORT-" + currentDateTime().replace(/[-: ]/g, "") + "-" + String(state.operationLogSequence + 1).padStart(4, "0");
    return recordOperationLog({
      category: "导出",
      action: options.action,
      targetType: options.targetType,
      targetId: options.targetId,
      summary: options.scope + " / " + format + " / " + options.rowCount + " 行",
      result: "处理中",
      values: [
        operationValue("导出格式", "—", format),
        operationValue("导出范围", "—", options.scope),
        operationValue("筛选条件", "—", operationFilterSummary()),
        operationValue("预计导出行数", "—", options.rowCount),
        operationValue("导出字段数", "—", options.fieldCount == null ? "系统默认" : options.fieldCount),
        operationValue("导出字段", "—", options.fieldNames || (selectedFields.length ? selectedFields.join("、") : "系统标准字段")),
        operationValue("导出任务 ID", "—", exportTaskId),
        operationValue("文件有效期", "—", "任务完成后 24 小时"),
        operationValue("任务阶段", "—", "已创建，等待生成文件")
      ]
    });
  }

  function recordStatementSnapshotOperation(snapshot) {
    recordOperationLog({
      category: "快照",
      action: "生成客户资金对账快照",
      targetType: "客户资金对账单",
      targetId: snapshot.statementNo,
      summary: snapshot.customer + " / " + snapshot.period,
      values: [
        operationValue("客户", "—", snapshot.customer),
        operationValue("查询期间", "—", snapshot.period),
        operationValue("查询起点余额", "—", snapshot.balanceAvailable ? money(snapshot.openingBalance, snapshot.currency) : "不可计算"),
        operationValue("查询结束余额", "—", snapshot.balanceAvailable ? money(snapshot.closingBalance, snapshot.currency) : "不可计算"),
        operationValue("资金流水数", "—", snapshot.flowCount),
        operationValue("异常流水数", "—", snapshot.abnormalCount)
      ]
    });
  }

  function sensitiveOperationCategory(action) {
    if (action.indexOf("异常") >= 0) return "异常处理";
    if (action.indexOf("账单") >= 0 && action.indexOf("关闭") >= 0) return "账单管理";
    return "对账处理";
  }

  function sensitiveOperationLineNo(context) {
    var match = /Line\s+(\d+)/.exec(context && context.targetId ? context.targetId : "");
    return match ? Number(match[1]) : 0;
  }

  function sensitiveOperationValues(action, context) {
    context = context || {};
    var lineNo = sensitiveOperationLineNo(context);
    var factoryLine = lineNo ? data.reconciliationLines.find(function (line) { return line.lineNo === lineNo; }) : null;
    var logisticsLine = lineNo ? data.logisticsReconcileLines.find(function (line) { return line.lineNo === lineNo; }) : null;
    var factoryBill = data.bills.find(function (bill) { return bill.id === context.targetId; });
    var logisticsBill = data.logisticsBills.find(function (bill) { return bill.id === context.targetId; });
    var exception = data.exceptions.find(function (item) { return item.id === context.targetId; });

    if (action === "关闭账单" && factoryBill) {
      return [
        operationValue("操作前状态", factoryBill.status, "已关闭"),
        operationValue("工厂", "—", factoryBill.supplier),
        operationValue("工厂账单号", "—", factoryBill.supplierBillNo),
        operationValue("账单金额", "—", money(factoryBill.totalAmount, factoryBill.currency))
      ];
    }
    if (action === "关闭物流账单" && logisticsBill) {
      return [
        operationValue("操作前状态", logisticsBill.status, "已关闭"),
        operationValue("物流商", "—", logisticsBill.carrier),
        operationValue("物流账单号", "—", logisticsBill.billNo),
        operationValue("原币账单金额", "—", money(logisticsBill.totalAmount, logisticsBill.originalCurrency)),
        operationValue("人民币折算金额", "—", money(logisticsBill.totalAmountCny, logisticsBill.baseCurrency))
      ];
    }
    if (action === "关闭重复明细" && factoryLine) {
      return [
        operationValue("操作前状态", factoryLine.matchStatus, "已关闭"),
        operationValue("工厂订单号", "—", factoryLine.supplierOrderNo),
        operationValue("采购单", "—", factoryLine.systemPurchaseNo),
        operationValue("账单金额", "—", money(factoryLine.billAmount, factoryLine.currency))
      ];
    }
    if (action === "按系统金额确认" && factoryLine) {
      return [
        operationValue("操作前状态", factoryLine.status, "已确认"),
        operationValue("确认金额", money(factoryLine.billAmount, factoryLine.currency), money(factoryLine.systemAmount, factoryLine.currency)),
        operationValue("采购单", "—", factoryLine.systemPurchaseNo),
        operationValue("订单 / SKU", "—", factoryLine.systemOrderId + " / " + factoryLine.systemSku)
      ];
    }
    if (action === "标记工厂账单错误" && factoryLine) {
      return [
        operationValue("操作前状态", factoryLine.matchStatus, "工厂账单错误"),
        operationValue("工厂账单金额", "—", money(factoryLine.billAmount, factoryLine.currency)),
        operationValue("系统采购金额", "—", money(factoryLine.systemAmount, factoryLine.currency)),
        operationValue("差异金额", "—", money(factoryLine.diff, factoryLine.currency))
      ];
    }
    if (action === "暂缓差异处理" && factoryLine) {
      return [
        operationValue("操作前状态", factoryLine.status, "暂缓处理"),
        operationValue("工厂账单金额", "—", money(factoryLine.billAmount, factoryLine.currency)),
        operationValue("系统采购金额", "—", money(factoryLine.systemAmount, factoryLine.currency)),
        operationValue("差异金额", "—", money(factoryLine.diff, factoryLine.currency))
      ];
    }
    if (action === "创建外部补录采购单" && factoryLine) {
      return [
        operationValue("采购单状态", "不存在", "已创建"),
        operationValue("订单 / SKU / 数量", "—", factoryLine.systemOrderId + " / " + factoryLine.billSku + " / " + factoryLine.qty),
        operationValue("工厂", "—", factoryLine.supplier),
        operationValue("采购金额", "—", money(factoryLine.billAmount, factoryLine.currency)),
        operationValue("价格来源", "—", "工厂账单")
      ];
    }
    if (action === "人工确认采购单" && factoryLine) {
      return [
        operationValue("操作前状态", factoryLine.matchStatus, "人工匹配"),
        operationValue("选择的采购单", "候选待选", context.selectedPo || "未指定"),
        operationValue("订单 / SKU / 数量", "—", factoryLine.systemOrderId + " / " + factoryLine.systemSku + " / " + factoryLine.qty),
        operationValue("匹配方式", factoryLine.method, "人工确认")
      ];
    }
    if ((action === "标记物流成本异常" || action === "暂缓物流成本异常") && logisticsLine) {
      return [
        operationValue("操作前状态", logisticsLine.matchStatus, action.indexOf("暂缓") >= 0 ? "暂缓处理" : "待人工处理"),
        operationValue("Tracking / 面单", "—", logisticsLine.tracking + " / " + logisticsLine.labelNo),
        operationValue("原币预估成本", "—", money(logisticsLine.estimatedCost, logisticsLine.originalCurrency)),
        operationValue("原币实际成本", "—", money(logisticsLine.actualCost, logisticsLine.originalCurrency)),
        operationValue("记账汇率", "—", logisticsLine.exchangeRate.toFixed(4)),
        operationValue("人民币差异", "—", money(logisticsLine.diffCny, logisticsLine.baseCurrency))
      ];
    }
    if (action === "确认异常处理结果" && exception) {
      return [
        operationValue("操作前状态", exception.status, "已解决"),
        operationValue("异常类型", "—", exception.type),
        operationValue("影响金额", "—", money(exception.amount, exception.currency)),
        operationValue("关联单据", "—", exception.billId + " / " + exception.orderId)
      ];
    }
    if (action.indexOf("暂缓") >= 0) return [operationValue("操作前状态", "处理中", "暂缓处理")];
    if (action.indexOf("物流成本异常") >= 0) return [operationValue("异常标记", "未标记", "已标记"), operationValue("操作后状态", "成本异常", "待人工处理")];
    return [operationValue("操作前状态", "待处理", "已确认")];
  }

  function recordSensitiveConfirmation(action) {
    var pending = state.pendingSensitiveOperation || {};
    var noteInput = modalBody.querySelector("textarea");
    var values = (pending.values || sensitiveOperationValues(action, pending)).slice();
    values.push(operationValue("处理备注", "—", noteInput ? noteInput.value.trim() : "未填写"));
    recordOperationLog({
      category: sensitiveOperationCategory(action),
      action: action,
      targetType: pending.targetType || "财务对象",
      targetId: pending.targetId || "—",
      values: values
    });
    state.pendingSensitiveOperation = null;
  }

  function operationValuesTable(values) {
    return '<div class="table-wrap operation-value-table"><table><thead><tr><th>记录字段</th><th>操作前</th><th>操作后</th></tr></thead><tbody>' + values.map(function (value) {
      return '<tr><td>' + esc(value.field) + '</td><td>' + esc(value.before) + '</td><td>' + esc(value.after) + '</td></tr>';
    }).join("") + '</tbody></table></div>';
  }

  function operationLogQueryRange() {
    var reference = new Date();
    reference.setHours(0, 0, 0, 0);
    var start;
    var end;
    if (state.filters.range === "今日") {
      start = reference;
      end = addDays(start, 1);
    } else if (state.filters.range === "本周") {
      var weekday = reference.getDay() || 7;
      start = addDays(reference, 1 - weekday);
      end = addDays(start, 7);
    } else if (state.filters.range === "上月") {
      start = new Date(reference.getFullYear(), reference.getMonth() - 1, 1);
      end = new Date(reference.getFullYear(), reference.getMonth(), 1);
    } else if (state.filters.range === "自定义") {
      start = parseDateOnly(state.filters.customStart);
      var customEnd = parseDateOnly(state.filters.customEnd);
      if (!start || !customEnd || start.getTime() > customEnd.getTime()) return { valid: false };
      end = addDays(customEnd, 1);
    } else {
      start = new Date(reference.getFullYear(), reference.getMonth(), 1);
      end = new Date(reference.getFullYear(), reference.getMonth() + 1, 1);
    }
    return { valid: true, startAt: dateBoundary(start), endAt: dateBoundary(end) };
  }

  function operationLogMatchesSearch(log) {
    if (!state.table.q) return true;
    var q = state.table.q.toLowerCase();
    var valueText = log.values.map(function (value) {
      return [value.field, value.before, value.after].join(" ");
    }).join(" ");
    return [log.id, log.category, log.action, log.targetType, log.targetId, log.summary, log.operator, log.result, log.requestId, valueText]
      .join(" ").toLowerCase().indexOf(q) >= 0;
  }

  function renderOperationLogs() {
    var category = state.pageFilters.operationCategory || "all";
    var result = state.pageFilters.operationResult || "all";
    var operator = state.pageFilters.operationOperator || "all";
    var logRange = operationLogQueryRange();
    var rows = state.operationLogs.filter(function (log) {
      var inRange = logRange.valid && log.occurredAt >= logRange.startAt && log.occurredAt < logRange.endAt;
      return inRange && (category === "all" || log.category === category) && (result === "all" || log.result === result) && (operator === "all" || log.operator === operator);
    });
    rows = rows.filter(operationLogMatchesSearch);
    var p = paginate(rows, 14);
    var exportCount = state.operationLogs.filter(function (log) { return log.category === "导出"; }).length;
    var paymentCount = state.operationLogs.filter(function (log) { return log.category === "付款操作"; }).length;
    var failedCount = state.operationLogs.filter(function (log) { return ["失败", "已拒绝"].indexOf(log.result) >= 0; }).length;
    pageEl.innerHTML = '<section class="grid grid-4">' +
      kpi("日志总数", state.operationLogs.length, "仅追加，不可修改") +
      kpi("导出记录", exportCount, "全部导出任务") +
      kpi("付款记录", paymentCount, "结算付款敏感操作") +
      kpi("失败 / 拒绝", failedCount, "保留失败原因与权限结果", failedCount ? "alert" : "") + '</section>' +
      '<section class="page-section">' + toolbar(
        selectPage("operationCategory", ["全部操作分类", "导出", "账单导入", "对账处理", "结算操作", "付款操作", "快照", "配置变更", "异常处理", "账单管理"], category) +
        selectPage("operationResult", ["全部执行结果", "成功", "处理中", "失败", "已拒绝"], result) +
        selectPage("operationOperator", ["全部操作人", "王敏", "陈露", "李哲", "周航", "系统"], operator)
      ) + '</section>' +
      '<section class="page-section">' + panel("财务操作日志", "记录所有导出与敏感操作；不同操作在详情中展示对应的业务值和前后差异", operationLogsTable(p.rows) + p.html) + '</section>';
  }

  function operationLogsTable(rows) {
    if (!rows.length) return '<div class="empty"><div><h3>没有匹配的操作日志</h3><p>请调整时间、操作分类、执行结果、操作人或关键词。</p></div></div>';
    return '<div class="table-wrap table-tall"><table class="operation-log-table"><thead><tr><th>日志编号</th><th>操作时间</th><th>操作分类</th><th>操作名称</th><th>业务对象</th><th>关键记录值</th><th>操作人</th><th>执行结果</th><th>请求编号</th><th class="sticky-action">操作</th></tr></thead><tbody>' + rows.map(function (log) {
      return '<tr><td>' + esc(log.id) + '</td><td>' + esc(log.occurredAt) + '</td><td>' + tag(log.category, "blue") + '</td><td>' + esc(log.action) + '</td><td><strong>' + esc(log.targetId) + '</strong><small class="cell-meta">' + esc(log.targetType) + '</small></td><td><span class="operation-log-summary">' + esc(log.summary) + '</span></td><td>' + esc(log.operator) + '</td><td>' + tag(log.result) + '</td><td>' + esc(log.requestId) + '</td><td class="sticky-action"><button class="link-button" data-open-operation-log="' + esc(log.id) + '">查看详情</button></td></tr>';
    }).join("") + '</tbody></table></div>';
  }

  function openOperationLog(id) {
    var log = state.operationLogs.find(function (item) { return item.id === id; });
    if (!log) return;
    openDrawer("操作日志详情", log.id,
      summary([["操作分类", tag(log.category, "blue")], ["操作名称", esc(log.action)], ["操作人", esc(log.operator)], ["执行结果", tag(log.result)]]) +
      '<section class="drawer-section"><h3>业务对象</h3>' + simpleTable(["对象类型", "对象编号", "操作时间", "请求编号"], [[esc(log.targetType), esc(log.targetId), esc(log.occurredAt), esc(log.requestId)]]) + '</section>' +
      '<section class="drawer-section"><h3>本次操作记录值</h3><p class="section-description">字段随操作类型变化；未参与该操作的业务值不会写入日志。</p>' + operationValuesTable(log.values) + '</section>' +
      '<section class="drawer-section"><h3>请求上下文</h3>' + simpleTable(["来源 IP", "写入方式", "修改策略"], [[esc(log.sourceIp), "业务事务内追加写入", "禁止修改或删除"]]) + '</section>');
  }

  function buildCustomerStatementRow(account, range) {
    var flows = data.customerFlows.filter(function (flow) {
      return flow.customer === account.customer && flow.currency === account.currency && customerFlowInRange(flow, range);
    }).sort(function (a, b) {
      return b.occurred.localeCompare(a.occurred) || b.flowNo.localeCompare(a.flowNo);
    });
    var effectiveFlows = flows.filter(isEffectiveCustomerFlow);
    var opening = customerAccountOpeningBalance(range, account.customer, account.currency);
    var netMovement = sum(effectiveFlows, signedCustomerFlowAmount);
    var orderIds = effectiveFlows.filter(function (flow) {
      return flow.flowType === "ORDER_CONSUMPTION" && flow.orderId !== "—";
    }).map(function (flow) { return flow.orderId; });
    return {
      key: statementKey(account.customer, account.currency, range),
      statementNo: "—",
      customer: account.customer,
      currency: account.currency,
      period: statementPeriod(range),
      range: { startAt: range.startAt, endAt: range.endAt },
      balanceAvailable: opening.available,
      openingBalance: opening.value,
      rechargeAmount: sum(effectiveFlows.filter(function (flow) { return flow.flowType === "RECHARGE"; }), function (flow) { return flow.amount; }),
      consumptionAmount: sum(effectiveFlows.filter(function (flow) { return flow.flowType === "ORDER_CONSUMPTION"; }), function (flow) { return flow.amount; }),
      refundAmount: sum(effectiveFlows.filter(function (flow) { return flow.flowType === "ORDER_REFUND"; }), function (flow) { return flow.amount; }),
      manualCredit: sum(effectiveFlows.filter(function (flow) { return flow.flowType === "MANUAL_CREDIT"; }), function (flow) { return flow.amount; }),
      manualDebit: sum(effectiveFlows.filter(function (flow) { return flow.flowType === "MANUAL_DEBIT"; }), function (flow) { return flow.amount; }),
      closingBalance: opening.available ? round(opening.value + netMovement) : 0,
      orderCount: orderIds.filter(function (value, index, list) { return list.indexOf(value) === index; }).length,
      flowCount: flows.length,
      abnormalCount: effectiveFlows.filter(function (flow) { return flow.consistencyStatus !== "一致"; }).length,
      dataStatus: "实时查询",
      generatedAt: "随筛选实时计算",
      flows: flows
    };
  }

  function buildCustomerStatementRows() {
    var range = consumptionQueryRange();
    if (!range.valid) return [];
    return scopedCustomerAccounts().map(function (account) {
      var liveRow = buildCustomerStatementRow(account, range);
      var snapshots = state.statementSnapshots[liveRow.key] || [];
      return snapshots.length ? snapshots[snapshots.length - 1] : liveRow;
    });
  }

  function updateBadges() {
    setBadge("bills", data.bills.filter(function (b) { return ["待人工处理", "对账中", "已导入"].indexOf(b.status) >= 0; }).length);
    setBadge("reconcile", data.reconciliationLines.filter(function (l) { return l.status === "待处理"; }).length);
    setBadge("logisticsBills", data.logisticsBills.filter(function (b) { return ["待人工处理", "匹配中", "已导入"].indexOf(b.status) >= 0; }).length);
    setBadge("logisticsReconcile", data.logisticsReconcileLines.filter(function (l) { return ["未匹配", "重复", "成本异常", "严重偏差"].indexOf(l.matchStatus) >= 0; }).length);
    setBadge("exceptions", data.exceptions.filter(function (e) { return e.status !== "已关闭"; }).length);
    setBadge("consumption", data.customerFlows.filter(function (f) { return f.consistencyStatus !== "一致"; }).length);
  }
  function setBadge(name, value) {
    var el = document.querySelector('[data-badge="' + name + '"]');
    if (el) el.textContent = value;
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c];
    });
  }
  function sum(list, fn) { return list.reduce(function (total, item) { return total + fn(item); }, 0); }
  function round(n) { return Math.round(Number(n || 0) * 100) / 100; }
  function fmt(n) { return Number(n || 0).toLocaleString("zh-CN"); }
  function money(value, currency) {
    var n = Number(value || 0);
    return '<span class="amount ' + (n < 0 ? "negative" : "") + '">' + (n < 0 ? "-" : "") + Math.abs(n).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + esc(currency || data.baseCurrency) + "</span>";
  }
  function textMoney(value, currency) {
    return Number(value || 0).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + (currency || data.baseCurrency);
  }
  function currencyPolicy(logistics) {
    var title = logistics ? "物流双币种口径" : "统一人民币口径";
    var text = logistics
      ? "物流账单按原始币种分别对账和统计；跨币种汇总、财务入账与订单毛利统一使用汇率快照折算后的 CNY 金额。"
      : "除物流账单原始费用外，本页交易、余额、成本、结算与利润金额统一使用 CNY。";
    return '<section class="currency-policy"><strong>' + title + '</strong><span>' + text + '</span></section>';
  }
  function logisticsCurrencySummary(rows, originalField, cnyField, label) {
    var cards = data.logisticsCurrencies.map(function (currency) {
      var scoped = rows.filter(function (row) { return row.originalCurrency === currency; });
      if (!scoped.length) return "";
      return kpi(currency + " " + label, money(sum(scoped, function (row) { return row[originalField] || 0; }), currency), scoped.length + " 条同币种记录");
    }).join("");
    var cnyTotal = sum(rows, function (row) { return row[cnyField] || 0; });
    return '<section class="page-section grid grid-6">' + cards + kpi("人民币折算合计", money(cnyTotal, data.baseCurrency), "仅折算后跨币种汇总") + '</section>';
  }
  function tag(value, tone) { return '<span class="tag ' + (tone || toneFor(value)) + '">' + esc(value) + "</span>"; }
  function help(text) {
    return '<span class="help" role="button" tabindex="0" aria-label="' + esc(text) + '" data-tip="' + esc(text) + '">?</span>';
  }
  function labelHelp(label, fallback) {
    var tip = FIELD_HELP[label] || fallback;
    return '<span class="label-help"><span>' + esc(label) + '</span>' + (tip ? help(tip) : "") + '</span>';
  }
  function enhanceHelp(root) {
    var scope = root || document;
    scope.querySelectorAll("th").forEach(function (th) {
      if (th.querySelector(".help")) return;
      var label = th.textContent.trim();
      var tip = FIELD_HELP[label];
      if (tip) th.innerHTML = labelHelp(label, tip);
    });
    scope.querySelectorAll(".filterbar label > span").forEach(function (span) {
      if (span.querySelector(".help")) return;
      var label = span.textContent.trim();
      var tip = FIELD_HELP[label];
      if (tip) span.insertAdjacentHTML("beforeend", help(tip));
    });
  }

  function initHelpTooltip() {
    if (helpTooltip) return;
    helpTooltip = document.createElement("div");
    helpTooltip.id = "help-tooltip";
    helpTooltip.className = "help-tooltip";
    helpTooltip.setAttribute("role", "tooltip");
    helpTooltip.setAttribute("aria-hidden", "true");
    helpTooltip.hidden = true;
    document.body.appendChild(helpTooltip);

    document.addEventListener("pointerover", function (event) {
      var trigger = event.target.closest && event.target.closest(".help");
      if (!trigger) return;
      if (activeHelp !== trigger) helpTooltipPinned = false;
      showHelpTooltip(trigger);
    });
    document.addEventListener("pointerout", function (event) {
      var trigger = event.target.closest && event.target.closest(".help");
      if (!trigger || trigger.contains(event.relatedTarget)) return;
      if (!helpTooltipPinned && document.activeElement !== trigger) hideHelpTooltip();
    });
    document.addEventListener("focusin", function (event) {
      var trigger = event.target.closest && event.target.closest(".help");
      if (!trigger) return;
      if (activeHelp !== trigger) helpTooltipPinned = false;
      showHelpTooltip(trigger);
    });
    document.addEventListener("focusout", function (event) {
      if (event.target === activeHelp) hideHelpTooltip();
    });
    document.addEventListener("click", function (event) {
      var trigger = event.target.closest && event.target.closest(".help");
      if (!trigger) {
        hideHelpTooltip();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (activeHelp === trigger && helpTooltipPinned) {
        hideHelpTooltip();
        return;
      }
      helpTooltipPinned = true;
      trigger.focus({ preventScroll: true });
      showHelpTooltip(trigger);
    });
    document.addEventListener("keydown", function (event) {
      var trigger = event.target.closest && event.target.closest(".help");
      if (trigger && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        helpTooltipPinned = !(activeHelp === trigger && helpTooltipPinned);
        if (helpTooltipPinned) showHelpTooltip(trigger);
        else hideHelpTooltip();
        return;
      }
      if (event.key === "Escape" && activeHelp) hideHelpTooltip();
    });
    document.addEventListener("scroll", hideHelpTooltip, true);
    window.addEventListener("resize", hideHelpTooltip);
  }

  function showHelpTooltip(trigger) {
    if (!helpTooltip || !trigger || !trigger.dataset.tip) return;
    if (activeHelp && activeHelp !== trigger) {
      activeHelp.classList.remove("is-active");
      activeHelp.removeAttribute("aria-describedby");
    }
    activeHelp = trigger;
    activeHelp.classList.add("is-active");
    activeHelp.setAttribute("aria-describedby", helpTooltip.id);
    helpTooltip.textContent = trigger.dataset.tip;
    helpTooltip.hidden = false;
    helpTooltip.setAttribute("aria-hidden", "false");
    helpTooltip.classList.add("is-visible");
    positionHelpTooltip(trigger);
  }

  function positionHelpTooltip(trigger) {
    var viewportGap = 12;
    var triggerGap = 9;
    helpTooltip.style.left = "0px";
    helpTooltip.style.top = "0px";
    var triggerRect = trigger.getBoundingClientRect();
    var tooltipRect = helpTooltip.getBoundingClientRect();
    var spaceAbove = triggerRect.top - viewportGap;
    var spaceBelow = window.innerHeight - triggerRect.bottom - viewportGap;
    var placement = spaceAbove >= tooltipRect.height + triggerGap || spaceAbove >= spaceBelow ? "top" : "bottom";
    var top = placement === "top"
      ? triggerRect.top - tooltipRect.height - triggerGap
      : triggerRect.bottom + triggerGap;
    var left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
    var maxLeft = Math.max(viewportGap, window.innerWidth - tooltipRect.width - viewportGap);
    left = Math.min(Math.max(viewportGap, left), maxLeft);
    top = Math.min(Math.max(viewportGap, top), Math.max(viewportGap, window.innerHeight - tooltipRect.height - viewportGap));
    var arrowX = triggerRect.left + triggerRect.width / 2 - left;
    arrowX = Math.min(Math.max(12, arrowX), tooltipRect.width - 12);
    helpTooltip.dataset.placement = placement;
    helpTooltip.style.setProperty("--help-arrow-x", arrowX + "px");
    helpTooltip.style.left = Math.round(left) + "px";
    helpTooltip.style.top = Math.round(top) + "px";
  }

  function hideHelpTooltip() {
    if (activeHelp) {
      activeHelp.classList.remove("is-active");
      activeHelp.removeAttribute("aria-describedby");
    }
    activeHelp = null;
    helpTooltipPinned = false;
    if (!helpTooltip) return;
    helpTooltip.classList.remove("is-visible");
    helpTooltip.setAttribute("aria-hidden", "true");
    helpTooltip.hidden = true;
  }

  function enhanceSelects(root) {
    var scope = root || document;
    scope.querySelectorAll("select").forEach(function (select) {
      if (select.dataset.searchReady === "true") {
        syncSearchSelect(select);
        return;
      }
      select.dataset.searchReady = "true";
      select.classList.add("select-native");
      select.tabIndex = -1;
      var wrapper = document.createElement("div");
      wrapper.className = "search-select";
      wrapper.dataset.searchSelect = "";
      wrapper.innerHTML = '<button type="button" class="search-select-trigger" aria-haspopup="listbox" aria-expanded="false"><span></span></button>' +
        '<div class="search-select-popover" hidden><input class="search-select-input" type="search" placeholder="搜索选项" autocomplete="off"><div class="search-select-options" role="listbox"></div></div>';
      select.insertAdjacentElement("afterend", wrapper);
      var trigger = wrapper.querySelector(".search-select-trigger");
      var input = wrapper.querySelector(".search-select-input");
      trigger.addEventListener("click", function () { toggleSearchSelect(select, true); });
      trigger.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
          event.preventDefault();
          toggleSearchSelect(select, true);
        }
      });
      input.addEventListener("input", function () { renderSearchOptions(select, input.value); });
      input.addEventListener("keydown", function (event) {
        var options = Array.prototype.slice.call(wrapper.querySelectorAll(".search-select-option:not([hidden])"));
        var current = document.activeElement;
        var index = options.indexOf(current);
        if (event.key === "Escape") {
          event.preventDefault();
          toggleSearchSelect(select, false);
          trigger.focus();
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          (options[index + 1] || options[0] || input).focus();
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          (options[index - 1] || options[options.length - 1] || input).focus();
        }
      });
      select.addEventListener("change", function () { syncSearchSelect(select); });
      syncSearchSelect(select);
    });
  }

  function getSearchSelect(select) {
    var next = select.nextElementSibling;
    return next && next.dataset.searchSelect !== undefined ? next : null;
  }

  function syncSearchSelect(select) {
    var wrapper = getSearchSelect(select);
    if (!wrapper) return;
    var selected = select.options[select.selectedIndex] || select.options[0];
    var text = selected ? selected.textContent : "请选择";
    wrapper.querySelector(".search-select-trigger span").textContent = text;
    renderSearchOptions(select, "");
  }

  function toggleSearchSelect(select, open) {
    var wrapper = getSearchSelect(select);
    if (!wrapper) return;
    document.querySelectorAll(".search-select.is-open").forEach(function (item) {
      if (item !== wrapper) closeSearchSelect(item);
    });
    if (!open) {
      closeSearchSelect(wrapper);
      return;
    }
    wrapper.classList.add("is-open");
    wrapper.querySelector(".search-select-popover").hidden = false;
    wrapper.querySelector(".search-select-trigger").setAttribute("aria-expanded", "true");
    var input = wrapper.querySelector(".search-select-input");
    input.value = "";
    renderSearchOptions(select, "");
    setTimeout(function () { input.focus(); input.select(); }, 0);
  }

  function closeSearchSelect(wrapper) {
    wrapper.classList.remove("is-open");
    wrapper.querySelector(".search-select-popover").hidden = true;
    wrapper.querySelector(".search-select-trigger").setAttribute("aria-expanded", "false");
  }

  function renderSearchOptions(select, query) {
    var wrapper = getSearchSelect(select);
    if (!wrapper) return;
    var list = wrapper.querySelector(".search-select-options");
    var q = String(query || "").trim().toLowerCase();
    var options = Array.prototype.slice.call(select.options).filter(function (option) {
      return !q || option.textContent.toLowerCase().indexOf(q) >= 0 || String(option.value).toLowerCase().indexOf(q) >= 0;
    });
    if (!options.length) {
      list.innerHTML = '<div class="search-select-empty">无匹配选项</div>';
      return;
    }
    list.innerHTML = options.map(function (option) {
      var active = option.selected ? " is-selected" : "";
      return '<button type="button" class="search-select-option' + active + '" role="option" data-value="' + esc(option.value) + '" aria-selected="' + (option.selected ? "true" : "false") + '">' + esc(option.textContent) + '</button>';
    }).join("");
    list.querySelectorAll(".search-select-option").forEach(function (button) {
      button.addEventListener("click", function () { chooseSearchOption(select, button.dataset.value); });
      button.addEventListener("keydown", function (event) {
        var visible = Array.prototype.slice.call(list.querySelectorAll(".search-select-option"));
        var index = visible.indexOf(button);
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          chooseSearchOption(select, button.dataset.value);
        }
        if (event.key === "Escape") {
          event.preventDefault();
          toggleSearchSelect(select, false);
          wrapper.querySelector(".search-select-trigger").focus();
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          (visible[index + 1] || visible[0] || button).focus();
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          (visible[index - 1] || visible[visible.length - 1] || button).focus();
        }
      });
    });
  }

  function chooseSearchOption(select, value) {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    var wrapper = getSearchSelect(select);
    if (wrapper && wrapper.isConnected) {
      syncSearchSelect(select);
      closeSearchSelect(wrapper);
      wrapper.querySelector(".search-select-trigger").focus();
    }
  }
  function toneFor(value) {
    if (value === "成功") return "success";
    if (["已确认", "退款已生效", "已完成", "已结算", "已付款", "自动匹配", "成本正常", "正常", "已对账", "已匹配账单"].indexOf(value) >= 0) return "success";
    if (["失败", "已拒绝", "待处理", "金额差异", "平台缺单", "未匹配", "重复", "已逾期", "异常", "严重异常", "严重偏差", "无实际账单"].indexOf(value) >= 0) return "danger";
    if (["处理中", "对账中", "待人工处理", "待结算", "部分付款", "部分完成", "待对账", "系统缺账", "匹配中", "成本异常", "中度异常", "轻微偏差"].indexOf(value) >= 0) return "warn";
    return "blue";
  }
  function kpi(label, value, meta, tone, target) {
    var tagName = target ? "button" : "div";
    return '<' + tagName + ' class="kpi ' + (tone || "") + '"' + (target ? ' data-kpi-target="' + target + '"' : "") + '><div class="kpi-label">' + labelHelp(label) + (target ? "<span>可跳转</span>" : "") + '</div><strong class="kpi-value">' + value + '</strong><div class="kpi-meta">' + esc(meta || "") + '</div></' + tagName + '>';
  }
  function panel(title, desc, body, actions) {
    return '<section class="panel"><header class="panel-head"><div><h3>' + labelHelp(title) + '</h3><p>' + esc(desc || "") + '</p></div><div class="panel-actions">' + (actions || "") + '</div></header><div class="panel-body">' + body + '</div></section>';
  }
  function simpleTable(headers, rows) {
    return '<div class="table-wrap"><table><thead><tr>' + headers.map(function (h, i) { return '<th class="' + (i > 0 ? "num" : "") + '">' + labelHelp(h) + '</th>'; }).join("") + '</tr></thead><tbody>' +
      rows.map(function (row) { return '<tr>' + row.map(function (cell, i) { return '<td class="' + (i > 0 ? "num" : "") + '">' + cell + '</td>'; }).join("") + '</tr>'; }).join("") +
      '</tbody></table></div>';
  }

  function rowMatchesCommon(row) {
    if (state.filters.customer !== "all" && row.customer && row.customer !== state.filters.customer) return false;
    if (state.filters.supplier !== "all" && row.supplier && row.supplier !== state.filters.supplier) return false;
    if (state.filters.currency !== "all" && row.currency && row.currency !== state.filters.currency) return false;
    if (state.filters.orderType !== "all" && row.orderType && row.orderType !== state.filters.orderType) return false;
    if (state.filters.orderType !== "all" && row.type && ["正常单", "售后单", "补发单"].indexOf(row.type) >= 0 && row.type !== state.filters.orderType) return false;
    if (state.filters.sku !== "all" && row.sku && row.sku !== state.filters.sku) return false;
    return true;
  }
  function filterBySearch(rows) {
    if (!state.table.q) return rows;
    var q = state.table.q.toLowerCase();
    return rows.filter(function (row) { return Object.keys(row).map(function (k) { return row[k]; }).join(" ").toLowerCase().indexOf(q) >= 0; });
  }
  function applyPageFilters(rows) {
    return rows.filter(function (row) {
      if (state.pageFilters.incomeType && state.pageFilters.incomeType !== "all" && row.type !== state.pageFilters.incomeType) return false;
      if (state.pageFilters.expenseType && state.pageFilters.expenseType !== "all" && row.type !== state.pageFilters.expenseType) return false;
      if (state.pageFilters.counterpartyType && state.pageFilters.counterpartyType !== "all" && row.counterpartyType !== state.pageFilters.counterpartyType) return false;
      if (state.pageFilters.status && state.pageFilters.status !== "all" && row.status !== state.pageFilters.status) return false;
      if (state.pageFilters.reconciled && state.pageFilters.reconciled !== "all" && row.reconcileStatus !== state.pageFilters.reconciled) return false;
      if (state.pageFilters.settled && state.pageFilters.settled !== "all" && row.settlementStatus !== state.pageFilters.settled) return false;
      if (state.pageFilters.billStatus && state.pageFilters.billStatus !== "all" && row.status !== state.pageFilters.billStatus) return false;
      if (state.pageFilters.customerType && state.pageFilters.customerType !== "all" && row.customerType !== state.pageFilters.customerType) return false;
      if (state.pageFilters.platform && state.pageFilters.platform !== "all" && row.platform !== state.pageFilters.platform) return false;
      if (state.pageFilters.cancelled && state.pageFilters.cancelled !== "all" && row.cancelled !== state.pageFilters.cancelled) return false;
      if (state.pageFilters.refunded && state.pageFilters.refunded !== "all" && row.refunded !== state.pageFilters.refunded) return false;
      if (state.pageFilters.produced && state.pageFilters.produced !== "all" && row.produced !== state.pageFilters.produced) return false;
      if (state.pageFilters.external && state.pageFilters.external !== "all" && row.external !== state.pageFilters.external) return false;
      if (state.pageFilters.flowType && state.pageFilters.flowType !== "all" && row.flowType !== state.pageFilters.flowType) return false;
      if (state.pageFilters.consistencyStatus && state.pageFilters.consistencyStatus !== "all" && row.consistencyStatus !== state.pageFilters.consistencyStatus) return false;
      if (state.pageFilters.logisticsBillId && state.pageFilters.logisticsBillId !== "all" && row.billId !== state.pageFilters.logisticsBillId) return false;
      if (state.pageFilters.factoryBillId && state.pageFilters.factoryBillId !== "all" && row.billId !== state.pageFilters.factoryBillId) return false;
      if (state.pageFilters.feeType && state.pageFilters.feeType !== "all") {
        if (state.pageFilters.feeType === "产品费" && !row.productFee) return false;
        if (state.pageFilters.feeType === "物流费" && !row.logisticsFee) return false;
        if (state.pageFilters.feeType === "设计费" && !row.designFee) return false;
        if (state.pageFilters.feeType === "服务费" && !row.serviceFee) return false;
        if (state.pageFilters.feeType === "其他费" && !row.otherFee) return false;
      }
      return true;
    });
  }
  function toolbar(extra) {
    return '<div class="toolbar"><input data-search placeholder="快速搜索：订单号 / 采购单 / 账单号 / 客户 / 工厂" value="' + esc(state.table.q) + '">' + (extra || "") + '<button class="button button-secondary" data-clear-search>清除</button></div>';
  }
  function paginate(rows, size) {
    var pageSize = size || 12;
    var pages = Math.max(1, Math.ceil(rows.length / pageSize));
    state.table.page = Math.min(state.table.page, pages);
    var start = (state.table.page - 1) * pageSize;
    return { rows: rows.slice(start, start + pageSize), html: pagination(rows.length, pageSize, state.table.page) };
  }
  function pagination(total, pageSize, page) {
    var pages = Math.max(1, Math.ceil(total / pageSize));
    var buttons = Array.from({ length: Math.min(7, pages) }, function (_, i) {
      var n = i + 1;
      return '<button class="pager-button ' + (n === page ? "is-active" : "") + '" data-page-value="' + n + '">' + n + '</button>';
    }).join("");
    return '<div class="pagination"><span class="pagination-summary">每页 ' + pageSize + " 条 · 共 " + total + " 条 · 第 " + page + " / " + pages + ' 页</span><div class="pager">' + buttons + '</div></div>';
  }

  function renderHome() {
    var income = sum(data.incomes, function (r) { return r.netAmount > 0 ? r.netAmount : 0; });
    var factoryCost = sum(data.expenses.filter(function (r) { return r.type.indexOf("工厂") >= 0; }), function (r) { return r.amount; });
    var logisticsCost = sum(data.expenses.filter(function (r) { return r.type.indexOf("物流") >= 0; }), function (r) { return r.amount; });
    var afterCost = sum(data.orders, function (o) { return o.afterCost; });
    var gross = sum(data.orders, function (o) { return o.gross; });
    var payable = sum(data.settlements, function (s) { return s.unpaid; });
    pageEl.innerHTML =
      '<section class="grid grid-6">' +
      kpi("客户业务收入", money(income, data.baseCurrency), "订单扣款后形成收入", "", "income") +
      kpi("工厂成本", money(factoryCost, data.baseCurrency), "发货后产生应付", "", "expense") +
      kpi("物流成本", money(logisticsCost, data.baseCurrency), "原币折算后人民币成本", "", "logistics") +
      kpi("售后成本", money(afterCost, data.baseCurrency), "平台承担成本", afterCost ? "warn" : "", "profit") +
      kpi("订单毛利", money(gross, data.baseCurrency), "人民币含售后毛利", gross < 0 ? "alert" : "", "profit") +
      kpi("毛利率", (gross / Math.max(income, 1) * 100).toFixed(1) + "%", "净收入口径") +
      '</section><section class="page-section grid grid-6">' +
      kpi("待导入/待处理账单", data.bills.filter(function (b) { return b.status !== "已关闭" && b.status !== "已结算"; }).length, "点击进入账单", "warn", "bills") +
      kpi("待对账采购单", data.reconciliationLines.filter(function (l) { return l.status === "待处理"; }).length, "采购单最小单位", "warn", "reconcile") +
      kpi("金额差异条数", data.reconciliationLines.filter(function (l) { return l.matchStatus === "金额差异"; }).length, "按系统金额确认", "alert", "reconcile") +
      kpi("平台缺单条数", data.reconciliationLines.filter(function (l) { return l.matchStatus === "平台缺单"; }).length, "创建外部补录采购单", "alert", "reconcile") +
      kpi("待结算金额", money(payable, data.baseCurrency), "工厂待付款", "warn", "settlement") +
      kpi("已逾期待办", 6, "对账/结算 SLA", "alert", "exceptions") + '</section>' +
      '<section class="page-section grid grid-2"><div>' + panel("收入 / 成本 / 毛利趋势", "按日、周、月切换的示意趋势", financeChart()) + '</div><div>' + panel("对账异常趋势", "金额差异 / 平台缺单 / 未匹配 / 重复", exceptionChart()) + '</div></section>' +
      '<section class="page-section">' + panel("核心页面入口", "从首页进入客户资金、账单、对账、物流和利润页面", quickEntry()) + '</section>' +
      '<section class="page-section">' + panel("待办列表", "点击进入对账工作台", todoTable()) + '</section>';
  }

  function quickEntry() {
    var pages = [["基础数据中心", "baseData"], ["客户消耗流水", "consumption"], ["客户资金对账单", "customerBills"], ["收入流水", "income"], ["支出流水", "expense"], ["工厂账单", "bills"], ["对账工作台", "reconcile"], ["工厂结算", "settlement"], ["物流账单", "logisticsBills"], ["物流成本对账", "logisticsReconcile"], ["订单利润", "profit"], ["财务异常", "exceptions"], ["操作日志", "operationLogs"]];
    return '<div class="quick-row">' + pages.map(function (p) { return '<button class="quick" data-go="' + esc(p[1]) + '">' + esc(p[0]) + '</button>'; }).join("") + '</div>';
  }

  function financeChart() {
    return svgChart("finance", "收入、成本与毛利趋势", [
      { id: "income", label: "收入", values: [82, 91, 96, 88, 110, 118, 126], color: "#245f9f", dash: "" },
      { id: "cost", label: "成本", values: [48, 52, 55, 61, 64, 69, 72], color: "#a15c00", dash: "8 5" },
      { id: "gross", label: "毛利", values: [34, 39, 41, 27, 46, 49, 54], color: "#19724c", dash: "2 4" }
    ]);
  }
  function exceptionChart() {
    return svgChart("exception", "对账异常趋势", [
      { id: "amountDiff", label: "金额差异", values: [6, 8, 5, 12, 10, 16, 18], color: "#b42331", dash: "" },
      { id: "platformMissing", label: "平台缺单", values: [3, 5, 4, 7, 9, 8, 11], color: "#a15c00", dash: "8 5" },
      { id: "unmatched", label: "未匹配", values: [4, 3, 6, 7, 8, 6, 10], color: "#245f9f", dash: "2 4" },
      { id: "duplicate", label: "重复", values: [1, 2, 1, 3, 2, 4, 3], color: "#667085", dash: "10 4 2 4" }
    ]);
  }
  function svgChart(chartId, chartLabel, series) {
    var days = ["08-07", "08-08", "08-09", "08-10", "08-11", "08-12", "08-13"];
    var chartState = state.chartSeries[chartId] || {};
    var w = 660, h = 220, left = 42, right = 18, top = 18, bottom = 28;
    var plotHeight = h - top - bottom;
    var maxValue = 1;
    series.forEach(function (item) {
      item.values.forEach(function (value) { maxValue = Math.max(maxValue, value); });
    });
    var magnitude = Math.pow(10, Math.max(0, Math.floor(Math.log(maxValue) / Math.LN10) - 1));
    var max = Math.ceil(maxValue * 1.1 / magnitude) * magnitude;
    var xStep = (w - left - right) / (days.length - 1);
    function p(v, i) { return [left + i * xStep, top + (max - v) / max * plotHeight]; }
    function axisValue(value) { return value % 1 === 0 ? value : value.toFixed(1); }
    var grid = [0, 1, 2, 3, 4].map(function (i) {
      var y = top + i * plotHeight / 4;
      var value = max - i * max / 4;
      return '<line class="chart-grid" x1="' + left + '" y1="' + y + '" x2="' + (w - right) + '" y2="' + y + '"></line>' +
        '<text class="chart-axis-label" x="' + (left - 7) + '" y="' + (y + 3) + '" text-anchor="end">' + axisValue(value) + '</text>';
    }).join("");
    var paths = series.map(function (item) {
      var visible = chartState[item.id] !== false;
      var d = item.values.map(function (value, i) { var pt = p(value, i); return (i ? "L" : "M") + pt[0] + "," + pt[1]; }).join(" ");
      var dash = item.dash ? ' stroke-dasharray="' + item.dash + '"' : "";
      var points = item.values.map(function (value, i) {
        var pt = p(value, i);
        return '<circle class="chart-point" cx="' + pt[0] + '" cy="' + pt[1] + '" r="3" stroke="' + item.color + '"></circle>';
      }).join("");
      return '<g id="chart-' + chartId + "-" + item.id + '" class="chart-series' + (visible ? "" : " is-hidden") + '" data-series="' + item.id + '">' +
        '<path class="chart-line" d="' + d + '" stroke="' + item.color + '"' + dash + '></path>' + points + '</g>';
    }).join("");
    var labels = days.map(function (d, i) { return '<text class="chart-label" x="' + (left + i * xStep - 12) + '" y="' + (h - 8) + '">' + d + "</text>"; }).join("");
    var visibleNames = series.filter(function (item) { return chartState[item.id] !== false; }).map(function (item) { return item.label; });
    var legend = '<fieldset class="chart-legend"><legend>显示指标</legend><div class="chart-legend-options">' + series.map(function (item) {
      var visible = chartState[item.id] !== false;
      var dash = item.dash ? ' stroke-dasharray="' + item.dash + '"' : "";
      return '<label class="chart-legend-item' + (visible ? "" : " is-muted") + '"><input type="checkbox" data-chart-id="' + chartId + '" data-chart-series="' + item.id + '" aria-controls="chart-' + chartId + "-" + item.id + '" style="accent-color:' + item.color + '"' + (visible ? " checked" : "") + '>' +
        '<svg class="chart-legend-sample" viewBox="0 0 32 8" aria-hidden="true"><line x1="1" y1="4" x2="31" y2="4" stroke="' + item.color + '"' + dash + '></line></svg>' +
        '<span class="chart-legend-text">' + esc(item.label) + '</span></label>';
    }).join("") + "</div></fieldset>";
    var ariaLabel = chartLabel + "。当前显示：" + (visibleNames.length ? visibleNames.join("、") : "未显示任何指标");
    return '<div class="interactive-chart" data-chart="' + chartId + '">' + legend + '<div class="chart-plot">' +
      '<svg class="chart" viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="none" role="img" data-chart-label="' + esc(chartLabel) + '" aria-label="' + esc(ariaLabel) + '">' + grid + paths + labels + '</svg>' +
      '<div class="chart-empty-state" data-chart-empty role="status"' + (visibleNames.length ? " hidden" : "") + '>未选择显示指标</div></div></div>';
  }
  function todoTable() {
    var rows = data.bills.slice(0, 8).map(function (b) {
      return [esc(b.supplier), esc(b.id), esc(b.period), b.amountDiff + b.platformMissing + b.unmatched, money(b.totalAmount - b.systemPayable, b.currency), tag(b.status), esc(b.importer), esc(b.importedAt), '<button class="link-button" data-go="reconcile">进入对账</button>'];
    });
    return simpleTable(["工厂", "账单号", "账期", "异常数量", "差异金额", "当前状态", "最后处理人", "更新时间", "操作"], rows);
  }

  function renderBaseData() {
    var tabs = ["订单金额数据", "订单详情 / SKU 数据", "采购单 / 工厂价格数据", "代理商价格与利润数据", "取消 / 退款数据", "全链路金额明细"];
    var rows = applyPageFilters(filterBySearch(baseRows(state.base.tab)));
    var p = paginate(rows, 10);
    pageEl.innerHTML =
      '<section class="grid grid-4">' +
      kpi("基础数据中心", tabs.length, "可导出数据集") +
      kpi("当前数据集", rows.length, state.base.tab) +
      kpi("代理商利润合计", money(sum(baseRows("代理商价格与利润数据"), function (r) { return r.agentProfitTotal; }), data.baseCurrency), "外部应付/内部绩效") +
      kpi("取消退款样例", baseRows("取消 / 退款数据").length, "未生产/已生产") + '</section>' +
      '<section class="page-section">' + baseTabs(tabs) + '</section>' +
      '<section class="page-section">' + baseToolbar() + '</section>' +
      '<section class="page-section base-layout"><div>' + panel(state.base.tab, "支持自定义字段、排序、筛选和导出当前筛选结果", baseTable(p.rows, baseColumns(state.base.tab)) + p.html) + '</div><div>' + panel("导出与字段模板", "原型模拟导出任务，不生成真实文件", exportPanel()) + '</div></section>';
  }
  function baseTabs(tabs) {
    return '<div class="tabs">' + tabs.map(function (t) {
      var count = baseRows(t).length;
      return '<button class="tab ' + (state.base.tab === t ? "is-active" : "") + '" data-base-tab="' + esc(t) + '" aria-pressed="' + (state.base.tab === t ? "true" : "false") + '"><span class="tab-label">' + labelHelp(t) + '</span><b class="tab-count">' + count + '</b></button>';
    }).join("") + '</div>';
  }
  function baseToolbar() {
    return toolbar(
      '<select><option>时间口径：下单时间</option><option>支付时间</option><option>采购单创建时间</option><option>工厂发货时间</option><option>退款时间</option></select>' +
      selectPage("customerType", ["全部客户类型", "普通客户", "外部代理商", "内部代理商"], state.pageFilters.customerType || "all") +
      selectPage("platform", ["全部平台", "Amazon", "Shopify", "TikTok Shop", "Walmart"], state.pageFilters.platform || "all") +
      selectPage("cancelled", ["是否取消", "是", "否"], state.pageFilters.cancelled || "all") +
      selectPage("refunded", ["是否退款", "是", "否"], state.pageFilters.refunded || "all") +
      selectPage("produced", ["是否已生产", "是", "否"], state.pageFilters.produced || "all") +
      selectPage("external", ["是否外部补录采购单", "是", "否"], state.pageFilters.external || "all") +
      '<label class="toolbar-toggle"><input type="checkbox" data-base-include-void ' + (state.base.includeVoid ? "checked" : "") + '><span>' + labelHelp("包含历史/作废采购单") + '</span></label>'
    );
  }
  function exportPanel() {
    var columns = baseColumns(state.base.tab).map(function (c) { return c[0]; });
    var presets = ["客户订单金额", "客户消耗对账", "工厂采购对账", "代理商利润", "物流成本", "取消退款", "全链路金额"];
    return '<div class="export-block"><h4>预置模板</h4><div class="template-row">' + presets.map(function (name, i) {
      return '<button class="quick ' + (i === 0 ? "is-active" : "") + '" data-export-template="' + esc(name) + '">' + esc(name) + '</button>';
    }).join("") + '</div></div>' +
      '<div class="export-block"><h4>自定义导出字段</h4><div class="field-picker">' + columns.map(function (name, i) {
        return '<label><input type="checkbox" checked> <span>' + esc(String(i + 1).padStart(2, "0") + " " + name) + '</span><button class="field-move" data-field-move="' + esc(name) + '" title="调整字段顺序">↕</button></label>';
      }).join("") + '</div></div>' +
      '<div class="export-block export-options"><select data-export-format><option>XLSX</option><option>CSV</option></select><select data-export-scope><option>导出范围：当前页</option><option>导出范围：当前筛选结果</option><option>导出范围：全部匹配结果</option></select></div>' +
      '<div class="drawer-actions"><button class="button button-primary" data-export-base-page>导出当前页</button><button class="button button-secondary" data-export-base>导出当前筛选结果</button><button class="button button-secondary" data-export-base-all>导出全部匹配结果</button><button class="button button-secondary" data-save-export-template>保存导出模板</button></div>' +
      '<div class="audit-log export-log"><div class="audit-item"><time>任务状态</time><strong>创建导出任务 → 处理中 → 已完成 → 下载</strong><span>' + tag("模拟", "blue") + '</span></div></div>';
  }
  function baseMeta(order, i) {
    var platforms = ["Amazon", "Shopify", "TikTok Shop", "Walmart"];
    var customerType = i % 9 === 1 ? "外部代理商" : i % 10 === 2 ? "内部代理商" : "普通客户";
    var agent = customerType === "普通客户" ? "—" : (customerType === "外部代理商" ? "Agent West" : "Agent Ops");
    var qty = customerType === "普通客户" ? 1 + i % 3 : 3;
    var standardPrice = round((order.productIncome || 60) / qty + 10);
    var agentPrice = customerType === "普通客户" ? round(standardPrice - 20) : 80;
    var agentSalePrice = customerType === "普通客户" ? round(standardPrice) : 100;
    var dealPrice = round((order.productIncome || 60) / qty);
    var unitAgentProfit = round(agentSalePrice - agentPrice);
    var agentProfitTotal = customerType === "普通客户" ? 0 : round(unitAgentProfit * qty);
    var cancelled = i % 22 === 0 || i === 5 || i === 11 ? "是" : "否";
    var produced = cancelled === "是" ? (i === 11 || i % 44 === 0 ? "是" : "否") : (i % 4 === 0 ? "否" : "是");
    var refunded = order.refund > 0 || (cancelled === "是" && produced === "否") ? "是" : "否";
    var preOnlineFee = i % 5 === 0 ? 2 : 0;
    var payableDesign = round(order.designFee * .35);
    var otherService = order.serviceFee;
    var customerPayable = round(order.productIncome + order.logisticsIncome + order.designFee + preOnlineFee + otherService);
    if (i === 5 || i === 11) customerPayable = 137;
    var actualDebit = customerPayable;
    var refundAmount = cancelled === "是" && produced === "否" ? customerPayable : order.refund;
    if (i === 11) refundAmount = 0;
    var customerNet = round(actualDebit - refundAmount);
    var factoryCost = produced === "是" ? order.factoryCost : 0;
    if (i === 7 && produced === "是") factoryCost = round(30 * qty);
    var logistics = data.logisticsCosts.find(function (l) { return l.orderId === order.id; });
    var actualLogistics = logistics && logistics.actualCost ? logistics.actualCostCny : order.logisticsCost;
    var currentGross = round(customerNet - factoryCost - actualLogistics - order.afterCost);
    return {
      index: i, platform: platforms[i % platforms.length], customerType: customerType, agent: agent, qty: qty,
      standardPrice: standardPrice, agentPrice: agentPrice, agentSalePrice: agentSalePrice, dealPrice: dealPrice,
      unitAgentProfit: unitAgentProfit, agentProfitTotal: agentProfitTotal,
      agentPayableProfit: customerType === "外部代理商" ? agentProfitTotal : 0,
      internalPerformanceProfit: customerType === "内部代理商" ? agentProfitTotal : 0,
      needAgentPayout: customerType === "外部代理商" ? "是" : "否",
      cancelled: cancelled, produced: produced, refunded: refunded, preOnlineFee: preOnlineFee, payableDesign: payableDesign,
      otherService: otherService, customerPayable: customerPayable, actualDebit: actualDebit, refundAmount: refundAmount,
      customerNet: customerNet, factoryCost: factoryCost, estimatedLogistics: order.estimatedLogisticsCostCny || order.logisticsCost,
      actualLogistics: actualLogistics, currentGross: currentGross,
      profitStatus: cancelled === "是" && produced === "否" ? "取消已退款" : cancelled === "是" && produced === "是" ? "取消不退款" : (logistics && logistics.actualCost ? "最终" : "暂估"),
      orderStatus: cancelled === "是" ? "已取消" : "已付款", poStatus: produced === "是" ? "已发货" : "已作废",
      external: i % 23 === 0 ? "是" : "否"
    };
  }
  function baseRows(tab) {
    if (tab === "订单金额数据") return data.orders.slice(0, 54).map(function (o, i) {
      var m = baseMeta(o, i);
      return {
        id: o.id, orderNo: o.id, platformOrderNo: o.id.replace("ORDER", "AMZ"), customer: o.customer, customerType: m.customerType, agent: m.agent,
        type: o.type, created: o.created, paidAt: o.paidAt, status: m.orderStatus, cancelled: m.cancelled, refunded: m.refunded,
        productTotal: o.productIncome, receivableShipping: o.logisticsIncome, payableShipping: o.logisticsCost, receivableDesign: o.designFee, payableDesign: m.payableDesign,
        preOnlineFee: m.preOnlineFee, otherService: m.otherService, customerPayable: m.customerPayable, actualDebit: m.actualDebit, refundAmount: m.refundAmount,
        customerNet: m.customerNet, factoryCost: m.factoryCost, estimatedLogistics: m.estimatedLogistics, actualLogistics: m.actualLogistics,
        originalGross: o.originalGross, currentGross: m.currentGross, profitStatus: m.profitStatus, currency: o.currency, platform: m.platform, sku: o.sku, supplier: o.supplier
      };
    });
    if (tab === "订单详情 / SKU 数据") return data.orders.slice(0, 54).map(function (o, i) {
      var m = baseMeta(o, i);
      return {
        id: o.id, orderNo: o.id, detailId: o.detailId, sku: o.sku, skuName: "商品 " + o.sku.slice(-4), attrs: ["Black / L", "White / M", "Blue / XL"][i % 3],
        qty: m.qty, customer: o.customer, customerType: m.customerType, standardPrice: m.standardPrice, dealPrice: m.dealPrice, agentPrice: m.agentPrice, agentSalePrice: m.agentSalePrice,
        unitAgentProfit: m.unitAgentProfit, agentProfitTotal: m.agentProfitTotal, productAmount: o.productIncome, factoryCount: i % 7 === 0 ? 2 : 1,
        supplier: o.supplier, purchaseNo: o.purchaseNo, currentFactoryPrice: i === 7 ? 35 : round(o.factoryCost / m.qty), purchaseAmount: m.factoryCost || o.factoryCost,
        produced: m.produced, shipped: m.produced, cancelled: m.cancelled, refunded: m.refunded, currency: o.currency, type: o.type, platform: m.platform
      };
    });
    if (tab === "采购单 / 工厂价格数据") {
      var rows = data.orders.slice(0, 54).map(function (o, i) {
        var m = baseMeta(o, i);
        return {
          id: "POID-" + o.purchaseNo.slice(-5), purchaseNo: o.purchaseNo, orderNo: o.id, detailId: o.detailId, sku: o.sku, attrs: ["Black / L", "White / M", "Blue / XL"][i % 3],
          qty: m.qty, supplier: o.supplier, currentFactoryPrice: i === 7 ? 35 : round(o.factoryCost / m.qty), factoryPriceSnapshot: i === 7 ? 30 : round(o.factoryCost / m.qty),
          purchaseAmount: i === 7 ? round(30 * m.qty) : o.factoryCost, poType: m.external === "是" ? "外部补录" : "正常采购", poStatus: m.poStatus, voided: m.produced === "否" ? "是" : "否",
          external: m.external, created: o.created, sentAt: o.created, acceptedAt: dateShift(o.created, 2), producedAt: m.produced === "是" ? dateShift(o.created, 24) : "—",
          shippedAt: m.produced === "是" ? o.shippedAt : "—", costGenerated: m.factoryCost ? "是" : "否", factoryCostAmount: m.factoryCost,
          reconcileStatus: o.reconciled, settlementStatus: o.settlement, currency: o.currency, customer: o.customer, customerType: m.customerType, platform: m.platform, type: o.type
        };
      });
      if (state.base.includeVoid) rows = rows.concat(rows.slice(0, 4).map(function (r, i) {
        var copy = Object.assign({}, r);
        copy.purchaseNo = "PO-VOID-" + String(7300 + i);
        copy.poStatus = "已作废";
        copy.voided = "是";
        copy.external = "否";
        copy.purchaseAmount = 0;
        copy.factoryCostAmount = 0;
        copy.costGenerated = "否";
        return copy;
      }));
      return rows;
    }
    if (tab === "代理商价格与利润数据") return data.orders.slice(0, 54).map(function (o, i) {
      var m = baseMeta(o, i);
      return {
        orderNo: o.id, detailId: o.detailId, agent: m.agent, agentType: m.customerType, sku: o.sku, qty: m.qty, standardPrice: m.standardPrice,
        agentPrice: m.agentPrice, agentSalePrice: m.agentSalePrice, dealPrice: m.dealPrice, unitAgentProfit: m.unitAgentProfit,
        agentProfitTotal: m.agentProfitTotal, agentPayableProfit: m.agentPayableProfit, internalPerformanceProfit: m.internalPerformanceProfit,
        needAgentPayout: m.needAgentPayout, status: m.orderStatus, refunded: m.refunded, currency: o.currency, customer: o.customer, customerType: m.customerType, supplier: o.supplier, type: o.type, platform: m.platform
      };
    }).filter(function (r) { return r.agentType !== "普通客户"; });
    if (tab === "取消 / 退款数据") return data.orders.slice(0, 54).map(function (o, i) {
      var m = baseMeta(o, i);
      return {
        orderNo: o.id, customer: o.customer, created: o.created, cancelTime: m.cancelled === "是" ? dateShift(o.created, 8) : "—", cancelReason: m.cancelled === "是" ? (m.produced === "是" ? "已生产客户取消" : "未生产客户取消") : "—",
        cancelStage: m.produced === "是" ? "已生产" : "未生产", produced: m.produced, originalPay: m.customerPayable, actualDebit: m.actualDebit,
        shouldRefund: m.cancelled === "是" && m.produced === "否" ? m.actualDebit : 0, actualRefund: m.refundAmount, refundDone: m.refundAmount ? "是" : "否",
        originalPoCount: 1, cancelledPoCount: m.produced === "否" ? 1 : 0, producedPoCount: m.produced === "是" ? 1 : 0,
        factoryCostAmount: m.factoryCost, customerNet: m.customerNet, orderNetIncome: m.customerNet, orderCost: round(m.factoryCost + m.actualLogistics), currentGross: m.currentGross,
        abnormalStatus: m.cancelled === "是" && m.produced === "否" && m.refundAmount !== m.actualDebit ? "退款异常" : "正常",
        currency: o.currency, customerType: m.customerType, sku: o.sku, supplier: o.supplier, type: o.type, platform: m.platform, cancelled: m.cancelled, refunded: m.refunded
      };
    }).filter(function (r) { return r.cancelled === "是" || r.refunded === "是"; });
    var chainRows = data.orders.slice(0, 54).map(function (o, i) {
      var m = baseMeta(o, i);
      return {
        orderNo: o.id, customer: o.customer, customerType: m.customerType, status: m.orderStatus, paidAt: o.paidAt, detailId: o.detailId, sku: o.sku, qty: m.qty,
        standardPrice: m.standardPrice, agentPrice: m.agentPrice, agentSalePrice: m.agentSalePrice, dealPrice: m.dealPrice, productAmount: o.productIncome,
        receivableShipping: o.logisticsIncome, payableShipping: o.logisticsCost, receivableDesign: o.designFee, payableDesign: m.payableDesign, preOnlineFee: m.preOnlineFee, otherService: m.otherService,
        customerPayable: m.customerPayable, actualDebit: m.actualDebit, refundAmount: m.refundAmount, customerNet: m.customerNet,
        supplier: o.supplier, purchaseNo: o.purchaseNo, voided: "否", factoryPriceSnapshot: i === 7 ? 30 : round(o.factoryCost / m.qty), purchaseAmount: i === 7 ? round(30 * m.qty) : o.factoryCost, factoryCost: m.factoryCost, reconcileStatus: o.reconciled, settlementStatus: o.settlement,
        estimatedLogistics: m.estimatedLogistics, actualLogistics: m.actualLogistics, logisticsDiff: round(m.actualLogistics - m.estimatedLogistics),
        agentProfitTotal: m.agentProfitTotal, originalGross: o.originalGross, currentGross: m.currentGross, profitStatus: m.profitStatus, currency: o.currency,
        platform: m.platform, type: o.type, cancelled: m.cancelled, refunded: m.refunded, produced: m.produced, external: m.external
      };
    });
    if (state.base.includeVoid) chainRows = chainRows.concat(chainRows.slice(0, 4).map(function (r, i) {
      var copy = Object.assign({}, r);
      copy.purchaseNo = "PO-VOID-" + String(7300 + i);
      copy.voided = "是";
      copy.factoryPriceSnapshot = i === 0 ? 30 : copy.factoryPriceSnapshot;
      copy.purchaseAmount = 0;
      copy.factoryCost = 0;
      copy.reconcileStatus = "已作废";
      copy.settlementStatus = "无需结算";
      copy.profitStatus = "历史采购单";
      return copy;
    }));
    return chainRows;
  }
  function dateShift(text, hours) {
    if (!text || text === "—") return "—";
    return text.replace(/(\d\d):(\d\d)$/, function (_, h, m) { return String((Number(h) + hours) % 24).padStart(2, "0") + ":" + m; });
  }
  function baseColumns(tab) {
    var map = {
      "订单金额数据": [["订单 ID", "id"], ["订单号", "orderNo"], ["平台订单号", "platformOrderNo"], ["客户", "customer"], ["客户类型", "customerType"], ["代理商", "agent"], ["订单类型", "type"], ["下单时间", "created"], ["支付时间", "paidAt"], ["订单状态", "status"], ["是否取消", "cancelled"], ["是否退款", "refunded"], ["产品总售价", "productTotal", "money"], ["应收运费", "receivableShipping", "money"], ["应付运费", "payableShipping", "money"], ["应收设计费", "receivableDesign", "money"], ["应付设计费", "payableDesign", "money"], ["预上网费", "preOnlineFee", "money"], ["其他服务费", "otherService", "money"], ["客户应付总金额", "customerPayable", "money"], ["实际扣款金额", "actualDebit", "money"], ["已退款金额", "refundAmount", "money"], ["客户净消耗", "customerNet", "money"], ["工厂成本", "factoryCost", "money"], ["预估物流成本", "estimatedLogistics", "money"], ["实际物流成本", "actualLogistics", "money"], ["原始毛利", "originalGross", "money"], ["当前毛利", "currentGross", "money"], ["利润状态", "profitStatus"], ["币种", "currency"]],
      "订单详情 / SKU 数据": [["订单 ID", "id"], ["订单号", "orderNo"], ["订单详情 ID", "detailId"], ["SKU", "sku"], ["SKU 名称", "skuName"], ["SKU 属性", "attrs"], ["数量", "qty"], ["客户", "customer"], ["客户类型", "customerType"], ["平台 SKU 标准对客价", "standardPrice", "money"], ["订单实际成交单价", "dealPrice", "money"], ["代理商价格", "agentPrice", "money"], ["代理商对客价", "agentSalePrice", "money"], ["单件代理商利润", "unitAgentProfit", "money"], ["代理商利润合计", "agentProfitTotal", "money"], ["本详情产品销售金额", "productAmount", "money"], ["已分配工厂数", "factoryCount"], ["当前有效工厂", "supplier"], ["当前有效采购单", "purchaseNo"], ["当前工厂单价", "currentFactoryPrice", "money"], ["当前采购金额", "purchaseAmount", "money"], ["是否生产", "produced"], ["是否发货", "shipped"], ["是否取消", "cancelled"], ["是否退款", "refunded"], ["币种", "currency"]],
      "采购单 / 工厂价格数据": [["采购单 ID", "id"], ["采购单号", "purchaseNo"], ["订单号", "orderNo"], ["订单详情 ID", "detailId"], ["SKU", "sku"], ["SKU 属性", "attrs"], ["数量", "qty"], ["工厂", "supplier"], ["SKU 当前工厂价", "currentFactoryPrice", "money"], ["采购单工厂价快照", "factoryPriceSnapshot", "money"], ["采购单总金额", "purchaseAmount", "money"], ["采购单类型", "poType"], ["采购单状态", "poStatus"], ["是否作废", "voided"], ["是否外部补录", "external"], ["创建时间", "created"], ["下发时间", "sentAt"], ["接单时间", "acceptedAt"], ["生产时间", "producedAt"], ["发货时间", "shippedAt"], ["是否已产生工厂成本", "costGenerated"], ["工厂成本金额", "factoryCostAmount", "money"], ["对账状态", "reconcileStatus"], ["结算状态", "settlementStatus"], ["币种", "currency"]],
      "代理商价格与利润数据": [["订单号", "orderNo"], ["订单详情 ID", "detailId"], ["代理商", "agent"], ["代理商类型", "agentType"], ["SKU", "sku"], ["数量", "qty"], ["平台 SKU 标准对客价", "standardPrice", "money"], ["平台给代理商的代理商价格", "agentPrice", "money"], ["代理商设置的对客价格", "agentSalePrice", "money"], ["实际订单成交单价", "dealPrice", "money"], ["单件代理商利润", "unitAgentProfit", "money"], ["代理商利润合计", "agentProfitTotal", "money"], ["代理商应得利润", "agentPayableProfit", "money"], ["内部绩效利润记录值", "internalPerformanceProfit", "money"], ["是否需要实际支付代理商利润", "needAgentPayout"], ["订单状态", "status"], ["是否退款", "refunded"], ["币种", "currency"]],
      "取消 / 退款数据": [["订单号", "orderNo"], ["客户", "customer"], ["下单时间", "created"], ["取消时间", "cancelTime"], ["取消原因", "cancelReason"], ["取消时状态", "cancelStage"], ["是否已经生产", "produced"], ["原客户支付金额", "originalPay", "money"], ["实际扣款金额", "actualDebit", "money"], ["应退款金额", "shouldRefund", "money"], ["实际退款金额", "actualRefund", "money"], ["是否完成退款", "refundDone"], ["原采购单数量", "originalPoCount"], ["已取消采购单数量", "cancelledPoCount"], ["已生产采购单数量", "producedPoCount"], ["工厂成本金额", "factoryCostAmount", "money"], ["当前客户净消耗", "customerNet", "money"], ["当前订单净收入", "orderNetIncome", "money"], ["当前订单成本", "orderCost", "money"], ["当前毛利", "currentGross", "money"], ["异常状态", "abnormalStatus"]],
      "全链路金额明细": [["订单号", "orderNo"], ["客户", "customer"], ["客户类型", "customerType"], ["订单状态", "status"], ["支付时间", "paidAt"], ["订单详情 ID", "detailId"], ["SKU", "sku"], ["数量", "qty"], ["平台 SKU 对客价", "standardPrice", "money"], ["代理商价", "agentPrice", "money"], ["代理商对客价", "agentSalePrice", "money"], ["实际成交单价", "dealPrice", "money"], ["产品销售金额", "productAmount", "money"], ["应收运费", "receivableShipping", "money"], ["应付运费", "payableShipping", "money"], ["应收设计费", "receivableDesign", "money"], ["应付设计费", "payableDesign", "money"], ["预上网费", "preOnlineFee", "money"], ["其他服务费", "otherService", "money"], ["客户应付金额", "customerPayable", "money"], ["实际扣款", "actualDebit", "money"], ["已退款", "refundAmount", "money"], ["净消耗", "customerNet", "money"], ["采购单号", "purchaseNo"], ["是否作废", "voided"], ["工厂", "supplier"], ["工厂单价快照", "factoryPriceSnapshot", "money"], ["采购金额", "purchaseAmount", "money"], ["工厂成本", "factoryCost", "money"], ["对账状态", "reconcileStatus"], ["结算状态", "settlementStatus"], ["预估物流成本", "estimatedLogistics", "money"], ["实际物流成本", "actualLogistics", "money"], ["物流成本差额", "logisticsDiff", "money"], ["代理商利润", "agentProfitTotal", "money"], ["原始毛利", "originalGross", "money"], ["当前毛利", "currentGross", "money"], ["利润状态", "profitStatus"]]
    };
    return map[tab] || map["订单金额数据"];
  }
  function baseTable(rows, columns) {
    return '<div class="table-wrap table-tall"><table class="base-table"><thead><tr>' + columns.map(function (c, i) { return '<th class="' + (c[2] === "money" || i > 10 ? "num" : "") + '">' + labelHelp(c[0]) + '</th>'; }).join("") + '<th class="sticky-action">操作</th></tr></thead><tbody>' +
      rows.map(function (row, ri) {
        return '<tr>' + columns.map(function (c, i) {
          var value = row[c[1]];
          var cell = c[2] === "money" ? money(value, row.currency || data.baseCurrency) : (["status", "profitStatus", "reconcileStatus", "settlementStatus", "abnormalStatus", "poStatus"].indexOf(c[1]) >= 0 ? tag(value) : esc(value == null ? "—" : value));
          return '<td class="' + (c[2] === "money" || i > 10 ? "num" : "") + '">' + cell + '</td>';
        }).join("") + '<td class="sticky-action"><button class="link-button" data-open-base-row="' + esc(state.base.tab + "::" + (row.orderNo || row.id || row.purchaseNo || ri)) + '">金额链路</button></td></tr>';
      }).join("") + '</tbody></table></div>';
  }

  function renderIncome() {
    var rows = applyPageFilters(filterBySearch(data.incomes.filter(rowMatchesCommon)));
    var p = paginate(rows, 14);
    pageEl.innerHTML = toolbar(incomeTypeSelect()) + '<section class="page-section">' + panel("收入流水", "客户充值不是业务收入，订单扣款后才形成订单收入", incomeTable(p.rows) + p.html) + '</section>';
  }
  function incomeTypeSelect() {
    return selectPage("incomeType", ["全部收入类型"].concat(data.incomeTypes), state.pageFilters.incomeType || "all") + selectPage("status", ["全部状态", "已确认", "退款已生效"], state.pageFilters.status || "all");
  }
  function incomeTable(rows) {
    return '<div class="table-wrap table-tall"><table><thead><tr><th>收入事件号</th><th>发生时间</th><th>客户</th><th>订单号</th><th>订单类型</th><th>订单详情</th><th>收入类型</th><th class="num">原始金额</th><th class="num">退款/冲销</th><th class="num">净金额</th><th>币种</th><th>来源单据</th><th>状态</th><th>操作人</th><th>备注</th><th class="sticky-action">操作</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr><td>' + esc(r.id) + '</td><td>' + esc(r.occurred) + '</td><td>' + esc(r.customer) + '</td><td>' + esc(r.orderId) + '</td><td>' + tag(r.orderType) + '</td><td>' + esc(r.detailId) + '</td><td>' + esc(r.type) + '</td><td class="num">' + money(r.originalAmount, r.currency) + '</td><td class="num">' + money(r.reversal, r.currency) + '</td><td class="num">' + money(r.netAmount, r.currency) + '</td><td>' + esc(r.currency) + '</td><td>' + esc(r.sourceDoc) + '</td><td>' + tag(r.status) + '</td><td>' + esc(r.operator) + '</td><td>' + esc(r.note) + '</td><td class="sticky-action"><button class="link-button" data-open-income="' + esc(r.id) + '">详情</button></td></tr>';
      }).join("") + '</tbody></table></div>';
  }

  function renderConsumption() {
    var range = consumptionQueryRange();
    var scopedRows = data.customerFlows.filter(customerFlowMatchesAccountScope).filter(function (row) { return customerFlowInRange(row, range); });
    var metricRows = scopedRows.filter(isEffectiveCustomerFlow);
    var rows = applyPageFilters(filterBySearch(scopedRows.filter(rowMatchesCommon)));
    var p = paginate(rows, 14);
    var opening = consumptionOpeningBalance(range);
    var recharge = sum(metricRows.filter(function (f) { return f.flowType === "RECHARGE"; }), function (f) { return f.amount; });
    var consumption = sum(metricRows.filter(function (f) { return f.flowType === "ORDER_CONSUMPTION"; }), function (f) { return f.amount; });
    var refund = sum(metricRows.filter(function (f) { return f.flowType === "ORDER_REFUND"; }), function (f) { return f.amount; });
    var manualCredit = sum(metricRows.filter(function (f) { return f.flowType === "MANUAL_CREDIT"; }), function (f) { return f.amount; });
    var manualDebit = sum(metricRows.filter(function (f) { return f.flowType === "MANUAL_DEBIT"; }), function (f) { return f.amount; });
    var closing = round(opening.value + sum(metricRows, signedCustomerFlowAmount));
    var orderCount = metricRows.filter(function (f) { return f.flowType === "ORDER_CONSUMPTION" && f.orderId && f.orderId !== "—"; }).map(function (f) { return f.orderId; }).filter(function (v, i, arr) { return arr.indexOf(v) === i; }).length;
    var abnormal = metricRows.filter(function (f) { return f.consistencyStatus !== "一致"; }).length;
    var unavailableMeta = range.valid ? "查询起点超出余额快照覆盖范围" : "请输入有效的查询时间范围";
    pageEl.innerHTML =
      '<section class="grid grid-6">' +
      kpi("查询起点余额", opening.available ? money(opening.value, data.baseCurrency) : "--", opening.available ? "查询开始前的有效客户余额" : unavailableMeta) +
      kpi("期间充值", money(recharge, data.baseCurrency), "RECHARGE 合计", "", "consumption") +
      kpi("期间订单消耗", money(consumption, data.baseCurrency), "ORDER_CONSUMPTION 合计", "", "consumption") +
      kpi("期间退款返还", money(refund, data.baseCurrency), "ORDER_REFUND 合计") +
      kpi("期间人工调增", money(manualCredit, data.baseCurrency), "MANUAL_CREDIT") +
      kpi("期间人工调减", money(manualDebit, data.baseCurrency), "MANUAL_DEBIT") +
      kpi("查询结束余额", opening.available ? money(closing, data.baseCurrency) : "--", opening.available ? "起点余额 + 期间有效资金净变动" : unavailableMeta) +
      kpi("消耗订单数", orderCount, "去重订单数") +
      kpi("消耗异常数", abnormal, "一致性异常", abnormal ? "alert" : "") + '</section>' +
      '<section class="page-section">' + toolbar(consumptionFilters()) + '</section>' +
      '<section class="page-section">' + panel("客户消耗流水", "展示充值、订单消耗、退款、调账和一致性状态", consumptionTable(p.rows) + p.html) + '</section>';
  }
  function consumptionFilters() {
    return selectPage("flowType", ["全部流水类型", "RECHARGE", "ORDER_CONSUMPTION", "ORDER_REFUND", "MANUAL_CREDIT", "MANUAL_DEBIT"], state.pageFilters.flowType || "all") +
      selectPage("feeType", ["全部费用类型", "产品费", "物流费", "设计费", "服务费", "其他费"], state.pageFilters.feeType || "all") +
      selectPage("consistencyStatus", ["全部一致性状态", "一致", "扣款不足", "重复扣款", "收入事件缺失", "收入金额不一致", "严重异常"], state.pageFilters.consistencyStatus || "all");
  }
  function consumptionTable(rows) {
    return '<div class="table-wrap table-tall"><table><thead><tr><th>资金流水号</th><th>发生时间</th><th>客户</th><th>流水类型</th><th>变动方向</th><th class="num">变动金额</th><th class="num">变动前余额</th><th class="num">变动后余额</th><th>订单号</th><th>平台订单号</th><th class="num">订单应付金额</th><th class="num">本次订单消耗金额</th><th>关联原流水号</th><th>币种</th><th>资金状态</th><th>订单支付状态</th><th>收入事件状态</th><th>一致性状态</th><th>来源</th><th>操作人</th><th>备注</th><th class="sticky-action">操作</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr><td>' + esc(r.flowNo) + '</td><td>' + esc(r.occurred) + '</td><td>' + esc(r.customer) + '</td><td>' + esc(r.flowType) + '</td><td>' + esc(r.direction) + '</td><td class="num">' + money(r.amount, r.currency) + '</td><td class="num">' + money(r.beforeBalance, r.currency) + '</td><td class="num">' + money(r.afterBalance, r.currency) + '</td><td>' + esc(r.orderId) + '</td><td>' + esc(r.platformOrderNo) + '</td><td class="num">' + money(r.orderPayable, r.currency) + '</td><td class="num">' + money(r.consumptionAmount, r.currency) + '</td><td>' + esc(r.originFlowNo) + '</td><td>' + esc(r.currency) + '</td><td>' + tag(r.fundStatus) + '</td><td>' + tag(r.orderPayStatus) + '</td><td>' + tag(r.incomeEventStatus) + '</td><td>' + tag(r.consistencyStatus) + '</td><td>' + esc(r.source) + '</td><td>' + esc(r.operator) + '</td><td>' + esc(r.remark) + '</td><td class="sticky-action"><button class="link-button" data-open-consumption="' + esc(r.flowNo) + '">详情</button></td></tr>';
      }).join("") + '</tbody></table></div>';
  }

  function renderCustomerStatements() {
    var rows = filterBySearch(buildCustomerStatementRows());
    var p = paginate(rows, 12);
    pageEl.innerHTML = toolbar('<button class="button button-secondary" data-export-customer-statement>导出当前查询</button>') +
      '<section class="page-section">' + panel("客户资金对账单", "未设置客户账期时按当前筛选实时对账；需要留档或交付客户时生成范围快照", customerStatementTable(p.rows) + p.html) + '</section>';
  }
  function customerStatementTable(rows) {
    return '<div class="table-wrap table-tall"><table><thead><tr><th>客户</th><th>查询期间</th><th>币种</th><th class="num">查询起点余额</th><th class="num">充值金额</th><th class="num">订单消耗金额</th><th class="num">退款返还金额</th><th class="num">其他调增</th><th class="num">其他调减</th><th class="num">查询结束余额</th><th class="num">消耗订单数</th><th class="num">资金流水数</th><th class="num">异常流水数</th><th>数据状态</th><th>查询/生成时间</th><th class="sticky-action">操作</th></tr></thead><tbody>' +
      rows.map(function (b) {
        var opening = b.balanceAvailable ? money(b.openingBalance, b.currency) : "—";
        var closing = b.balanceAvailable ? money(b.closingBalance, b.currency) : "—";
        var generateLabel = b.dataStatus === "已生成快照" ? "生成新快照" : "生成快照";
        return '<tr><td>' + esc(b.customer) + '</td><td>' + esc(b.period) + '</td><td>' + esc(b.currency) + '</td><td class="num">' + opening + '</td><td class="num">' + money(b.rechargeAmount, b.currency) + '</td><td class="num">' + money(b.consumptionAmount, b.currency) + '</td><td class="num">' + money(b.refundAmount, b.currency) + '</td><td class="num">' + money(b.manualCredit, b.currency) + '</td><td class="num">' + money(b.manualDebit, b.currency) + '</td><td class="num">' + closing + '</td><td class="num">' + b.orderCount + '</td><td class="num">' + b.flowCount + '</td><td class="num">' + b.abnormalCount + '</td><td>' + tag(b.dataStatus, b.dataStatus === "已生成快照" ? "success" : "blue") + '</td><td>' + esc(b.generatedAt) + '</td><td class="sticky-action"><button class="link-button" data-open-customer-statement="' + esc(b.key) + '">查看明细</button> · <button class="link-button" data-generate-customer-statement="' + esc(b.key) + '">' + generateLabel + '</button> · <button class="link-button" data-export-customer-statement="' + esc(b.key) + '">导出</button></td></tr>';
      }).join("") + '</tbody></table></div>';
  }

  function renderExpense() {
    var rows = applyPageFilters(filterBySearch(data.expenses.filter(rowMatchesCommon)));
    var p = paginate(rows, 14);
    pageEl.innerHTML = toolbar(expenseFilterSelect()) + '<section class="page-section">' + panel("支出流水", "统一查看工厂、物流商和售后成本事件，并按业务类型展示正确关联关系", expenseTable(p.rows) + p.html) + '</section>';
  }
  function expenseFilterSelect() {
    return selectPage("counterpartyType", ["全部成本方类型", "工厂", "物流商"], state.pageFilters.counterpartyType || "all") + selectPage("expenseType", ["全部支出类型"].concat(data.expenseTypes), state.pageFilters.expenseType || "all") + selectPage("reconciled", ["全部对账状态", "已完成", "部分完成", "待对账", "已匹配物流账单", "待物流对账"], state.pageFilters.reconciled || "all") + selectPage("settled", ["全部结算状态", "已结算", "待结算", "部分付款", "暂估不结算"], state.pageFilters.settled || "all");
  }
  function expenseTable(rows) {
    return '<div class="table-wrap table-tall"><table><thead><tr><th>支出事件号</th><th>发生时间</th><th>成本方类型</th><th>成本方</th><th>关联订单号</th><th>关联采购单号</th><th>订单详情</th><th>SKU</th><th>支出类型</th><th class="num">系统金额</th><th>币种</th><th>对账状态</th><th>结算状态</th><th>来源</th><th>外部补录</th><th class="sticky-action">操作</th></tr></thead><tbody>' +
      rows.map(function (r) {
        var external = r.counterpartyType === "工厂" ? tag(r.external ? "是" : "否", r.external ? "warn" : "success") : "—";
        return '<tr><td>' + esc(r.eventNo) + '</td><td>' + esc(r.occurred) + '</td><td>' + tag(r.counterpartyType, "blue") + '</td><td>' + esc(r.counterparty) + '</td><td>' + esc(r.orderId) + '</td><td>' + esc(r.purchaseNo) + '</td><td>' + esc(r.detailId) + '</td><td>' + esc(r.sku) + '</td><td>' + esc(r.type) + '</td><td class="num">' + money(r.amount, r.currency) + '</td><td>' + esc(r.currency) + '</td><td>' + tag(r.reconcileStatus) + '</td><td>' + tag(r.settlementStatus) + '</td><td>' + esc(r.source) + '</td><td>' + external + '</td><td class="sticky-action"><button class="link-button" data-open-expense="' + esc(r.id) + '">追溯</button></td></tr>';
      }).join("") + '</tbody></table></div>';
  }

  function renderFactoryCosts() {
    var rows = applyPageFilters(filterBySearch(data.expenses.filter(function (row) {
      return row.counterpartyType === "工厂" && rowMatchesCommon(row);
    })));
    var p = paginate(rows, 14);
    var billOptions = '<select data-page-filter="factoryBillId"><option value="all">全部工厂账单</option>' + data.bills.map(function (bill) {
      return '<option value="' + esc(bill.id) + '"' + (state.pageFilters.factoryBillId === bill.id ? " selected" : "") + '>' + esc(bill.id + " / " + bill.supplier) + '</option>';
    }).join("") + '</select>';
    pageEl.innerHTML = toolbar(billOptions + selectPage("reconciled", ["全部对账状态", "已完成", "部分完成", "待对账"], state.pageFilters.reconciled || "all") + selectPage("settled", ["全部结算状态", "已结算", "待结算", "部分付款"], state.pageFilters.settled || "all")) +
      '<section class="page-section">' + panel("工厂成本", "复用支出事件中的工厂成本事实，按采购单、订单、SKU 和工厂账单追溯", factoryCostsTable(p.rows) + p.html) + '</section>';
  }

  function factoryCostsTable(rows) {
    return '<div class="table-wrap table-tall"><table><thead><tr><th>支出事件号</th><th>订单号</th><th>采购单号</th><th>订单详情</th><th>SKU</th><th>工厂</th><th>工厂账单 ID</th><th class="num">成本金额（CNY）</th><th>对账状态</th><th>结算状态</th><th>来源</th><th>发生时间</th><th class="sticky-action">操作</th></tr></thead><tbody>' +
      rows.map(function (row) {
        return '<tr><td>' + esc(row.eventNo) + '</td><td>' + esc(row.orderId) + '</td><td>' + esc(row.purchaseNo) + '</td><td>' + esc(row.detailId) + '</td><td>' + esc(row.sku) + '</td><td>' + esc(row.supplier) + '</td><td>' + esc(row.billId) + '</td><td class="num">' + money(row.amount, row.currency) + '</td><td>' + tag(row.reconcileStatus) + '</td><td>' + tag(row.settlementStatus) + '</td><td>' + esc(row.source) + '</td><td>' + esc(row.occurred) + '</td><td class="sticky-action"><button class="link-button" data-open-expense="' + esc(row.id) + '">追溯</button></td></tr>';
      }).join("") + '</tbody></table></div>';
  }

  function renderBills() {
    var rows = applyPageFilters(filterBySearch(data.bills.filter(function (r) { return rowMatchesCommon(r); })));
    var p = paginate(rows, 12);
    pageEl.innerHTML = toolbar(selectPage("billStatus", ["全部对账状态", "草稿", "已导入", "对账中", "待人工处理", "已对账", "待结算", "已结算", "已关闭"], state.pageFilters.billStatus || "all") + '<button class="button button-primary" data-open-factory-import>导入工厂账单</button>') +
      '<section class="page-section">' + panel("工厂账单列表", "管理每次导入的工厂账单", billsTable(p.rows) + p.html) + '</section>';
  }
  function billsTable(rows) {
    return '<div class="table-wrap table-tall"><table><thead><tr><th>账单 ID</th><th>工厂</th><th>工厂账单号</th><th>账期</th><th>币种</th><th class="num">总条数</th><th class="num">总金额</th><th class="num">自动匹配</th><th class="num">金额差异</th><th class="num">平台缺单</th><th class="num">未匹配</th><th class="num">重复</th><th class="num">已确认</th><th class="num">系统应付</th><th>当前状态</th><th>导入人</th><th>导入时间</th><th class="sticky-action">操作</th></tr></thead><tbody>' +
      rows.map(function (b) {
        return '<tr><td>' + esc(b.id) + '</td><td>' + esc(b.supplier) + '</td><td>' + esc(b.supplierBillNo) + '</td><td>' + esc(b.period) + '</td><td>' + esc(b.currency) + '</td><td class="num">' + b.totalLines + '</td><td class="num">' + money(b.totalAmount, b.currency) + '</td><td class="num">' + b.autoMatched + '</td><td class="num">' + b.amountDiff + '</td><td class="num">' + b.platformMissing + '</td><td class="num">' + b.unmatched + '</td><td class="num">' + b.duplicated + '</td><td class="num">' + b.confirmed + '</td><td class="num">' + money(b.systemPayable, b.currency) + '</td><td>' + tag(b.status) + '</td><td>' + esc(b.importer) + '</td><td>' + esc(b.importedAt) + '</td><td class="sticky-action"><button class="link-button" data-open-bill="' + esc(b.id) + '">详情</button> · <button class="link-button" data-reconcile-bill="' + esc(b.id) + '">对账</button></td></tr>';
      }).join("") + '</tbody></table></div>';
  }

  function selectPage(name, options, selected) {
    return '<select data-page-filter="' + esc(name) + '">' + options.map(function (option, i) {
      var value = i === 0 ? "all" : option;
      return '<option value="' + esc(value) + '"' + (value === selected ? " selected" : "") + '>' + esc(option) + '</option>';
    }).join("") + '</select>';
  }

  function importConfig(kind) {
    if (kind === "factory") {
      return {
        partyLabel: "工厂",
        parties: ["Factory A", "Factory B", "Factory C", "Factory D", "Factory E", "Factory F"],
        headers: ["supplier_order_no", "platform_order_no", "purchase_id", "sku", "attrs", "qty", "amount", "ship_time"],
        fields: [["supplier_order_no", "工厂订单号"], ["platform_order_no", "平台订单号"], ["purchase_order_id", "采购单 ID"], ["sku", "SKU"], ["sku_attrs", "SKU 属性"], ["quantity", "数量"], ["total_amount", "总金额"], ["shipped_at", "发货时间"]],
        targetPage: "reconcile",
        targetLabel: "进入对账工作台"
      };
    }
    return {
      partyLabel: "物流商",
      parties: ["USPS", "UPS", "FedEx", "DHL"],
      headers: ["tracking_no", "label_no", "platform_order_no", "base_fee", "total_fee", "currency", "exchange_rate", "rate_date", "actual_weight", "bill_weight", "volume_weight", "country"],
      fields: [["tracking_no", "Tracking Number / 物流单号"], ["label_no", "面单号"], ["platform_order_no", "平台订单号"], ["base_fee", "实际基础运费"], ["total_fee", "实际总费用"], ["currency", "原始币种"], ["exchange_rate", "记账汇率"], ["rate_date", "汇率日期"], ["actual_weight", "实际重量"], ["bill_weight", "计费重量"], ["volume_weight", "体积重"], ["country", "国家/地区"]],
      targetPage: "logisticsReconcile",
      targetLabel: "进入物流成本对账"
    };
  }

  function defaultImportDraft(kind) {
    return kind === "factory"
      ? { party: "Factory A", billNo: "SUP-BILL-20260899", periodStart: "2026-08-01", periodEnd: "2026-08-10", currency: "CNY", templateName: "Factory A 账单模板" }
      : { party: "USPS", billNo: "USPS-USD-202608-099", periodStart: "2026-08-01", periodEnd: "2026-08-10", originalCurrency: "USD", exchangeRate: "7.1800", rateDate: "2026-08-10", templateName: "USPS 账单模板" };
  }

  function defaultImportMapping(kind) {
    var config = importConfig(kind);
    var mapping = {};
    config.headers.forEach(function (header, index) {
      mapping[header] = config.fields[index] ? config.fields[index][0] : "";
    });
    return mapping;
  }

  function seedImportTemplates() {
    return {
      factory: {
        "Factory A": [{ id: "factory-a-standard", name: "Factory A 标准账单模板", mappings: defaultImportMapping("factory") }]
      },
      logistics: {
        USPS: [{ id: "usps-standard", name: "USPS 月度账单模板", mappings: defaultImportMapping("logistics") }]
      }
    };
  }

  function resetImportWorkflow(kind) {
    state.importStep = 1;
    state.importFiles[kind] = null;
    state.importDrafts[kind] = defaultImportDraft(kind);
    state.importMappings[kind] = defaultImportMapping(kind);
    state.importProgress[kind] = 0;
    var templates = importTemplatesForParty(kind);
    state.importTemplateSelection[kind] = templates.length ? templates[0].id : "";
    if (state.importProgressTimer) {
      clearInterval(state.importProgressTimer);
      state.importProgressTimer = null;
    }
  }

  function importTemplatesForParty(kind) {
    var party = state.importDrafts[kind].party;
    return state.importTemplates[kind][party] || [];
  }

  function importModalContent(kind) {
    var heading = kind === "factory" ? "工厂账单导入" : "物流账单导入";
    var titles = ["选择主体与上传账单", "读取表头与字段映射", "确认账单信息", "导入与匹配进度"];
    return '<section class="stepper">' + [1, 2, 3, 4].map(function (n) {
      var stateClass = state.importStep === n ? "is-active" : n < state.importStep ? "is-complete" : "";
      return '<div class="step ' + stateClass + '"><b>Step ' + n + '</b><span>' + titles[n - 1] + '</span></div>';
    }).join("") + '</section><section class="drawer-section"><h3>' + heading + '</h3>' + importWorkflowBody(kind) + '</section>';
  }

  function factoryImportModalContent() {
    return importModalContent("factory");
  }

  function openFactoryImportModal(resetStep) {
    if (resetStep !== false) resetImportWorkflow("factory");
    modal.dataset.view = "factoryImport";
    openModal("工厂账单", "导入工厂账单", factoryImportModalContent());
  }

  function importFileUpload(kind) {
    var selectedFile = state.importFiles[kind];
    var inputId = kind === "factory" ? "factory-bill-file" : "logistics-bill-file";
    var inputData = kind === "factory" ? 'data-import-file="factory"' : 'data-import-file="logistics"';
    var description = kind === "factory" ? "上传工厂提供的账单明细" : "上传物流商提供的实际费用明细";
    return '<div class="import-upload">' +
      '<div class="import-upload-copy"><svg class="import-upload-icon" aria-hidden="true"><use href="#i-upload"></use></svg><div><strong>上传 Excel / CSV 账单</strong><span>' + esc(description) + '，支持 .xlsx、.xls、.csv</span></div></div>' +
      '<label class="button button-secondary import-upload-button" for="' + inputId + '">选择表格<input class="import-upload-input" id="' + inputId + '" type="file" accept=".xlsx,.xls,.csv" ' + inputData + '></label>' +
      '<div class="import-file-status ' + (selectedFile ? "is-selected" : "") + '" aria-live="polite"><strong>' + (selectedFile ? esc(selectedFile.name) : "尚未选择文件") + '</strong><span>' + (selectedFile ? "文件已就绪，可读取表头" : "请选择账单文件后继续") + '</span></div>' +
      '</div>';
  }

  function importPreviousButton() {
    return '<button class="button button-secondary" data-import-prev>上一步</button>';
  }

  function importStepBody() {
    return importWorkflowBody("factory");
  }

  function importWorkflowBody(kind) {
    if (state.importStep === 1) return importPartyAndUploadStep(kind);
    if (state.importStep === 2) return importMappingStep(kind);
    if (state.importStep === 3) return importReviewStep(kind);
    return importProgressStep(kind);
  }

  function importPartyAndUploadStep(kind) {
    var config = importConfig(kind);
    var draft = state.importDrafts[kind];
    var partyOptions = config.parties.map(function (party) {
      return '<option value="' + esc(party) + '"' + (party === draft.party ? " selected" : "") + '>' + esc(party) + '</option>';
    }).join("");
    return '<div class="import-form-grid">' +
      '<label class="form-field"><span>' + config.partyLabel + '</span><select data-import-field="party" data-import-kind="' + kind + '">' + partyOptions + '</select></label>' +
      '<label class="form-field"><span>' + (kind === "factory" ? "工厂账单号" : "物流账单号") + '</span><input value="' + esc(draft.billNo) + '" data-import-field="billNo" data-import-kind="' + kind + '" placeholder="请输入账单号" required></label>' +
      '</div>' + importFileUpload(kind) +
      '<div class="drawer-actions import-actions"><button class="button button-primary" data-import-next' + (state.importFiles[kind] && draft.billNo.trim() ? "" : ' disabled title="请填写账单号并选择账单文件"') + '>读取表格并进入下一步</button></div>';
  }

  function importMappingStep(kind) {
    var config = importConfig(kind);
    var mapping = state.importMappings[kind];
    var rows = config.headers.map(function (header) {
      var options = '<option value="">不映射</option>' + config.fields.map(function (field) {
        return '<option value="' + esc(field[0]) + '"' + (mapping[header] === field[0] ? " selected" : "") + '>' + esc(field[1]) + '</option>';
      }).join("");
      return [esc(header), '<select class="mapping-select" data-import-map="' + esc(header) + '" data-import-kind="' + kind + '">' + options + '</select>', mapping[header] ? tag("已映射", "success") : tag("未映射", "warn")];
    });
    return importTemplateControls(kind) +
      '<div class="mapping-read-result"><strong>已读取表格表头</strong><span>共 ' + config.headers.length + ' 列，可逐列修改映射字段。</span></div>' +
      simpleTable(["本次表头", "映射字段", "识别状态"], rows) +
      '<div class="drawer-actions">' + importPreviousButton() + '<button class="button button-primary" data-import-next>确认映射并继续</button></div>';
  }

  function importTemplateControls(kind) {
    var config = importConfig(kind);
    var draft = state.importDrafts[kind];
    var templates = importTemplatesForParty(kind);
    var selectedId = state.importTemplateSelection[kind];
    if (!templates.some(function (template) { return template.id === selectedId; })) {
      selectedId = templates.length ? templates[0].id : "";
      state.importTemplateSelection[kind] = selectedId;
    }
    var options = templates.length
      ? templates.map(function (template) { return '<option value="' + esc(template.id) + '"' + (template.id === selectedId ? " selected" : "") + '>' + esc(template.name) + '</option>'; }).join("")
      : '<option value="">暂无已保存模板</option>';
    return '<div class="template-workbench">' +
      '<div class="template-heading"><strong>' + esc(draft.party) + ' 的字段模板</strong><span>已读取 ' + templates.length + ' 个历史模板，仅作用于当前' + config.partyLabel + '。</span></div>' +
      '<label class="form-field"><span>选择已有模板</span><select data-import-template="' + kind + '">' + options + '</select></label>' +
      '<button class="button button-secondary" data-apply-import-template="' + kind + '"' + (templates.length ? "" : " disabled") + '>应用模板</button>' +
      '<label class="form-field"><span>模板名称</span><input value="' + esc(draft.templateName) + '" data-import-field="templateName" data-import-kind="' + kind + '"></label>' +
      '<button class="button button-secondary" data-save-import-template="' + kind + '">保存为当前' + config.partyLabel + '模板</button>' +
      '</div>';
  }

  function importPrecheck(kind) {
    if (kind === "factory") {
      return '<section class="grid grid-4">' + kpi("总行数", 168, "文件行数") + kpi("可识别行数", 152, "可进入匹配") + kpi("缺关键字段", 5, "不静默丢弃", "alert") + kpi("重复行", 3, "需确认", "warn") + kpi("无效金额", 2, "金额格式错误", "alert") + kpi("无法识别 SKU", 4, "需人工修正", "warn") + kpi("账期外数据", 2, "按确认账期校验", "warn") + '</section>';
    }
    return '<section class="grid grid-4">' + kpi("总行数", 214, "文件行数") + kpi("可识别行数", 193, "可进入匹配") + kpi("Tracking 缺失", 6, "禁止静默丢弃", "alert") + kpi("金额无效", 4, "需修正", "alert") + kpi("币种缺失", 3, "必填字段", "warn") + kpi("汇率缺失", 3, "不得进入人民币核算", "alert") + kpi("重复行", 5, "需确认", "warn") + kpi("账期外数据", 4, "按确认账期校验", "warn") + '</section>';
  }

  function importReviewStep(kind) {
    var config = importConfig(kind);
    var draft = state.importDrafts[kind];
    var selectedFile = state.importFiles[kind];
    var logisticsFields = kind === "logistics" ?
      '<label class="form-field"><span>原始币种</span><select data-import-field="originalCurrency" data-import-kind="logistics">' + ["USD", "EUR", "CNY", "GBP"].map(function (currency) { return '<option' + (currency === draft.originalCurrency ? " selected" : "") + '>' + currency + '</option>'; }).join("") + '</select></label>' +
      '<label class="form-field"><span>记账汇率</span><input type="number" min="0.0001" step="0.0001" value="' + esc(draft.exchangeRate) + '" data-import-field="exchangeRate" data-import-kind="logistics"></label>' +
      '<label class="form-field"><span>汇率日期</span><input type="date" value="' + esc(draft.rateDate) + '" data-import-field="rateDate" data-import-kind="logistics" required></label>' :
      '<label class="form-field"><span>币种</span><input value="CNY" readonly></label>';
    return importPrecheck(kind) +
      '<section class="import-review"><div class="import-review-head"><div><h4>账单导入信息</h4><p>账期已从表格内容识别，可在开始匹配前手动修改。</p></div>' + tag("表格识别，可修改", "blue") + '</div>' +
      summary([[config.partyLabel, esc(draft.party)], [kind === "factory" ? "工厂账单号" : "物流账单号", esc(draft.billNo)], ["文件", esc(selectedFile ? selectedFile.name : "—")], ["映射完成", Object.keys(state.importMappings[kind]).filter(function (header) { return state.importMappings[kind][header]; }).length + " / " + config.headers.length]]) +
      '<div class="import-form-grid import-period-fields"><label class="form-field"><span>账期开始</span><input type="date" value="' + esc(draft.periodStart) + '" data-import-field="periodStart" data-import-kind="' + kind + '"></label><label class="form-field"><span>账期结束</span><input type="date" value="' + esc(draft.periodEnd) + '" data-import-field="periodEnd" data-import-kind="' + kind + '"></label>' + logisticsFields + '</div>' +
      '<p class="form-error" data-import-review-error role="alert" hidden></p></section>' +
      '<div class="drawer-actions">' + importPreviousButton() + '<button class="button button-primary" data-start-import="' + kind + '">确认导入并开始匹配</button></div>';
  }

  function importProgressStep(kind) {
    var config = importConfig(kind);
    var progress = state.importProgress[kind];
    var complete = progress >= 100;
    var status = progress < 25 ? "正在上传账单文件" : progress < 50 ? "正在解析表格与字段映射" : progress < 80 ? "正在创建账单明细" : progress < 100 ? "正在执行自动匹配" : "导入与匹配已完成";
    var action = complete ? '<div class="drawer-actions"><button class="button button-primary" data-complete-import="' + config.targetPage + '">' + config.targetLabel + '</button></div>' : "";
    return '<div class="import-progress-card"><div class="import-progress-head"><div><h3>' + status + '</h3><p>' + (complete ? "对账任务已生成，可以进入对应工作台处理异常明细。" : "请勿关闭弹窗，完成后将开放对账入口。") + '</p></div><strong data-import-progress-value>' + progress + '%</strong></div>' +
      '<div class="import-progress" role="progressbar" aria-label="账单导入进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + progress + '"><span data-import-progress-bar style="width:' + progress + '%"></span></div>' +
      '<div class="import-progress-stages"><span class="' + (progress >= 25 ? "is-done" : "is-active") + '">上传文件</span><span class="' + (progress >= 50 ? "is-done" : progress >= 25 ? "is-active" : "") + '">解析表格</span><span class="' + (progress >= 80 ? "is-done" : progress >= 50 ? "is-active" : "") + '">生成明细</span><span class="' + (complete ? "is-done" : progress >= 80 ? "is-active" : "") + '">自动匹配</span></div>' + action + '</div>';
  }

  function validateImportReview(kind) {
    var draft = state.importDrafts[kind];
    if (!draft.periodStart || !draft.periodEnd) return "请填写完整的账期开始和结束时间。";
    if (draft.periodStart > draft.periodEnd) return "账期结束时间不能早于账期开始时间。";
    if (kind === "logistics") {
      var rate = Number(draft.exchangeRate);
      if (!Number.isFinite(rate) || rate <= 0) return "记账汇率必须是大于 0 的数字。";
      if (draft.originalCurrency === "CNY" && rate !== 1) return "原始币种为 CNY 时，记账汇率必须为 1。";
      if (!draft.rateDate) return "请选择本次账单使用的汇率日期。";
    }
    return "";
  }

  function showImportReviewError(message) {
    var error = modalBody.querySelector("[data-import-review-error]");
    if (!error) return;
    error.textContent = message || "";
    error.hidden = !message;
  }

  function refreshImportModal(kind) {
    if (kind === "factory") openFactoryImportModal(false);
    else openLogisticsImportModal(false);
  }

  function startImportProgress(kind) {
    var error = validateImportReview(kind);
    if (error) {
      showImportReviewError(error);
      return;
    }
    var draft = state.importDrafts[kind];
    var selectedFile = state.importFiles[kind];
    var selectedTemplate = importTemplatesForParty(kind).find(function (template) { return template.id === state.importTemplateSelection[kind]; });
    var generatedBillId = (kind === "factory" ? "BILL-IMPORT-" : "LBILL-IMPORT-") + currentDateTime().replace(/[-: ]/g, "") + "-" + String(state.operationLogSequence + 1).padStart(4, "0");
    var importValues = [
      operationValue(kind === "factory" ? "工厂" : "物流商", "—", draft.party),
      operationValue(kind === "factory" ? "工厂账单号" : "物流账单号", "—", draft.billNo),
      operationValue("上传文件", "—", selectedFile ? selectedFile.name : "—"),
      operationValue("账期", "—", draft.periodStart + " ~ " + draft.periodEnd),
      operationValue("映射模板", "—", selectedTemplate ? selectedTemplate.name + " / " + selectedTemplate.id : "本次手动映射"),
      operationValue("字段映射数", "—", Object.keys(state.importMappings[kind]).filter(function (header) { return state.importMappings[kind][header]; }).length)
    ];
    if (kind === "logistics") {
      importValues.push(operationValue("原始币种", "—", draft.originalCurrency));
      importValues.push(operationValue("记账汇率", "—", draft.exchangeRate));
      importValues.push(operationValue("汇率日期", "—", draft.rateDate));
      importValues.push(operationValue("汇率来源", "—", "系统日汇率快照"));
    }
    var importLog = recordOperationLog({
      category: "账单导入",
      action: kind === "factory" ? "导入工厂账单" : "导入物流账单",
      targetType: kind === "factory" ? "工厂账单" : "物流账单",
      targetId: draft.billNo,
      summary: draft.party + " / " + draft.periodStart + " ~ " + draft.periodEnd,
      values: importValues.concat([operationValue("任务阶段", "—", "已提交，等待解析与匹配")]),
      result: "处理中"
    });
    state.importAuditRequests[kind] = {
      requestId: importLog.requestId,
      targetId: draft.billNo,
      generatedBillId: generatedBillId,
      party: draft.party,
      period: draft.periodStart + " ~ " + draft.periodEnd,
      values: importValues
    };
    if (state.importProgressTimer) clearInterval(state.importProgressTimer);
    state.importStep = 4;
    state.importProgress[kind] = 8;
    refreshImportModal(kind);
    state.importProgressTimer = setInterval(function () {
      state.importProgress[kind] = Math.min(100, state.importProgress[kind] + 17 + Math.round(Math.random() * 8));
      refreshImportModal(kind);
      if (state.importProgress[kind] >= 100) {
        clearInterval(state.importProgressTimer);
        state.importProgressTimer = null;
        completeImportAudit(kind);
      }
    }, 320);
  }

  function completeImportAudit(kind) {
    var pending = state.importAuditRequests[kind];
    if (!pending) return;
    recordOperationLog({
      category: "账单导入",
      action: kind === "factory" ? "完成工厂账单导入" : "完成物流账单导入",
      targetType: kind === "factory" ? "工厂账单" : "物流账单",
      targetId: pending.generatedBillId,
      summary: pending.party + " / " + pending.period,
      requestId: pending.requestId,
      result: "成功",
      values: pending.values.concat([
        operationValue("任务阶段", "解析与匹配中", "已完成"),
        operationValue("生成账单 ID", "—", pending.generatedBillId),
        operationValue("导入结果", "—", "已生成账单明细与对账任务")
      ])
    });
    state.importAuditRequests[kind] = null;
  }

  function cancelPendingImportAudit() {
    ["factory", "logistics"].forEach(function (kind) {
      var pending = state.importAuditRequests[kind];
      if (!pending) return;
      recordOperationLog({
        category: "账单导入",
        action: kind === "factory" ? "取消工厂账单导入" : "取消物流账单导入",
        targetType: kind === "factory" ? "工厂账单" : "物流账单",
        targetId: pending.targetId,
        summary: pending.party + " / 用户在处理完成前关闭导入",
        requestId: pending.requestId,
        result: "失败",
        values: pending.values.concat([
          operationValue("任务阶段", "解析与匹配中", "已取消"),
          operationValue("失败原因", "—", "用户在任务完成前关闭导入弹窗")
        ])
      });
      state.importAuditRequests[kind] = null;
    });
  }

  function applyImportTemplate(kind) {
    var selectedId = state.importTemplateSelection[kind];
    var template = importTemplatesForParty(kind).find(function (item) { return item.id === selectedId; });
    if (!template) {
      toast("当前主体暂无可用模板");
      return;
    }
    state.importMappings[kind] = Object.assign({}, template.mappings);
    refreshImportModal(kind);
    toast("已应用模板：" + template.name);
  }

  function saveImportTemplate(kind) {
    var draft = state.importDrafts[kind];
    var party = draft.party;
    var name = String(draft.templateName || "").trim();
    if (!name) {
      toast("请先填写模板名称");
      return;
    }
    if (!state.importTemplates[kind][party]) state.importTemplates[kind][party] = [];
    var templates = state.importTemplates[kind][party];
    var existing = templates.find(function (template) { return template.name === name; });
    var mappingText = function (mappings) {
      return Object.keys(mappings || {}).filter(function (header) { return mappings[header]; }).map(function (header) {
        return header + " → " + mappings[header];
      }).join("；") || "无映射";
    };
    var previousMappingText = existing ? mappingText(existing.mappings) : "不存在";
    var previousMappedFieldCount = existing ? Object.keys(existing.mappings).filter(function (header) { return existing.mappings[header]; }).length : 0;
    var currentMappingText = mappingText(state.importMappings[kind]);
    var mappedFieldCount = Object.keys(state.importMappings[kind]).filter(function (header) { return state.importMappings[kind][header]; }).length;
    if (existing) {
      existing.mappings = Object.assign({}, state.importMappings[kind]);
      state.importTemplateSelection[kind] = existing.id;
    } else {
      var template = { id: kind + "-template-" + Date.now(), name: name, mappings: Object.assign({}, state.importMappings[kind]) };
      templates.push(template);
      state.importTemplateSelection[kind] = template.id;
    }
    recordOperationLog({
      category: "配置变更",
      action: "保存" + (kind === "factory" ? "工厂" : "物流商") + "字段映射模板",
      targetType: "字段映射模板",
      targetId: name,
      summary: party + " / " + mappedFieldCount + " 个映射字段",
      values: [
        operationValue("适用主体", "—", party),
        operationValue("模板名称", "—", name),
        operationValue("模板版本", existing ? "已有版本" : "不存在", existing ? "已更新" : "新建"),
        operationValue("映射字段数", previousMappedFieldCount, mappedFieldCount),
        operationValue("字段映射", previousMappingText, currentMappingText)
      ]
    });
    refreshImportModal(kind);
    toast("已保存为 " + party + " 的字段模板");
  }

  function renderReconcile() {
    var bill = data.bills.find(function (b) { return b.id === state.reconcile.selectedBill; }) || data.bills[0];
    var existingSettlement = data.settlements.find(function (s) { return s.billId === bill.id; });
    var settlementReady = bill.status === "已对账" || bill.status === "待结算";
    var settlementAction = existingSettlement
      ? '<button class="button button-secondary" data-go="settlement">查看结算单</button>'
      : settlementReady
        ? '<button class="button button-primary" data-open-settlement-create="' + esc(bill.id) + '">生成结算单</button>'
        : '<button class="button button-secondary" disabled title="完成对账后才可生成结算单">生成结算单</button>';
    var tabs = ["全部", "自动匹配", "金额差异", "平台缺单", "系统缺账", "未匹配", "重复", "已确认"];
    var lines = data.reconciliationLines.filter(function (l) { return state.reconcile.tab === "全部" || l.matchStatus === state.reconcile.tab || (state.reconcile.tab === "已确认" && l.status === "已确认"); });
    lines = filterBySearch(lines);
    var p = paginate(lines, 12);
    pageEl.innerHTML =
      '<section class="grid grid-6">' + kpi("工厂", bill.supplier, bill.id) + kpi("账单金额", money(bill.totalAmount, bill.currency), "工厂账单") + kpi("系统应付金额", money(bill.systemPayable, bill.currency), "最终结算依据") + kpi("差异金额", money(bill.totalAmount - bill.systemPayable, bill.currency), "需处理", "warn") + kpi("总条数", bill.totalLines, "账单明细") + kpi("待处理", data.reconciliationLines.filter(function (l) { return l.status === "待处理"; }).length, "人工处理", "alert") + '</section>' +
      '<section class="page-section">' + reconcileTabs(tabs) + '</section>' +
      '<section class="page-section">' + toolbar('<select data-selected-bill>' + data.bills.map(function (b) { return '<option value="' + esc(b.id) + '"' + (b.id === state.reconcile.selectedBill ? " selected" : "") + '>' + esc(b.id + " / " + b.supplier) + '</option>'; }).join("") + '</select>' + settlementAction) + '</section>' +
      '<section class="page-section">' + panel("对账明细", "采购单为最小对账单位；无法唯一匹配必须人工确认", reconcileTable(p.rows) + p.html) + '</section>';
  }
  function reconcileTabs(tabs) {
    return '<div class="tabs">' + tabs.map(function (t) {
      var count = t === "全部" ? data.reconciliationLines.length : data.reconciliationLines.filter(function (l) { return l.matchStatus === t || (t === "已确认" && l.status === "已确认"); }).length;
      return '<button class="tab ' + (state.reconcile.tab === t ? "is-active" : "") + '" data-reconcile-tab="' + esc(t) + '" aria-pressed="' + (state.reconcile.tab === t ? "true" : "false") + '"><span class="tab-label">' + esc(t) + '</span><b class="tab-count">' + count + '</b></button>';
    }).join("") + '</div>';
  }
  function reconcileTable(rows) {
    return '<div class="table-wrap table-tall"><table><thead><tr><th>行号</th><th>工厂订单号</th><th>平台订单号</th><th>账单 SKU</th><th>SKU 属性</th><th class="num">数量</th><th class="num">账单金额</th><th>系统采购单号</th><th>系统 SKU</th><th class="num">系统金额</th><th class="num">差异金额</th><th>匹配方式</th><th>匹配依据</th><th>状态</th><th>审核说明</th><th class="sticky-action">操作</th></tr></thead><tbody>' +
      rows.map(function (l) {
        return '<tr><td>' + l.lineNo + '</td><td>' + esc(l.supplierOrderNo) + '</td><td>' + esc(l.platformOrderNo) + '</td><td>' + esc(l.billSku) + '</td><td>' + esc(l.attrs) + '</td><td class="num">' + l.qty + '</td><td class="num">' + money(l.billAmount, l.currency) + '</td><td>' + esc(l.systemPurchaseNo) + '</td><td>' + esc(l.systemSku) + '</td><td class="num">' + money(l.systemAmount, l.currency) + '</td><td class="num">' + money(l.diff, l.currency) + '</td><td>' + esc(l.method) + '</td><td>' + esc(l.matchEvidence) + '</td><td>' + tag(l.matchStatus) + '</td><td>' + esc(l.reviewNote || "—") + '</td><td class="sticky-action">' + reconcileAction(l) + '</td></tr>';
      }).join("") + '</tbody></table></div>';
  }
  function reconcileAction(line) {
    if (line.matchStatus === "金额差异") return '<button class="link-button" data-handle-diff="' + line.lineNo + '">处理差异</button>';
    if (line.matchStatus === "平台缺单") return '<button class="link-button" data-handle-missing="' + line.lineNo + '">关联订单详情</button>';
    if (line.matchStatus === "未匹配") return '<button class="link-button" data-handle-candidate="' + line.lineNo + '">人工确认</button>';
    if (line.matchStatus === "重复") return '<button class="link-button" data-confirm-action="关闭重复明细" data-audit-target-type="工厂对账明细" data-audit-target-id="Line ' + line.lineNo + '">关闭</button>';
    return '<button class="link-button" data-open-reconcile-line="' + line.lineNo + '">查看</button>';
  }

  function settlementPayable(systemPayable, increaseAmount, decreaseAmount) {
    return round(round(systemPayable) + round(increaseAmount) - round(decreaseAmount));
  }

  function settlementAdjustmentsLocked(settlement) {
    return Number(settlement.paid || 0) > 0 || settlement.settlementStatus === "部分付款" || settlement.settlementStatus === "已付款";
  }

  function settlementAdjustmentForm(values) {
    var systemPayable = round(values.systemPayable);
    var increaseAmount = round(values.increaseAmount);
    var decreaseAmount = round(values.decreaseAmount);
    var payable = settlementPayable(systemPayable, increaseAmount, decreaseAmount);
    return '<div class="settlement-adjustment-form">' +
      '<label class="form-field"><span>增加金额</span><div class="money-input"><input type="number" min="0" step="0.01" value="' + increaseAmount + '" data-settlement-increase aria-describedby="settlement-adjustment-formula"><b>' + esc(values.currency) + '</b></div></label>' +
      '<label class="form-field"><span>减少金额</span><div class="money-input"><input type="number" min="0" step="0.01" value="' + decreaseAmount + '" data-settlement-decrease aria-describedby="settlement-adjustment-formula"><b>' + esc(values.currency) + '</b></div></label>' +
      '<label class="form-field form-field-wide"><span>备注</span><textarea maxlength="200" data-settlement-note placeholder="填写加款或减款原因">' + esc(values.adjustmentNote || "") + '</textarea></label>' +
      '<div class="settlement-total form-field-wide" id="settlement-adjustment-formula"><span>最终应付</span><strong data-settlement-final-payable data-system-payable="' + systemPayable + '" data-currency="' + esc(values.currency) + '">' + money(payable, values.currency) + '</strong><small>系统应付金额 + 增加金额 - 减少金额</small></div>' +
      '<p class="form-error form-field-wide" data-settlement-error role="alert" hidden></p>' +
      '</div>';
  }

  function readSettlementAdjustmentInputs(systemPayable) {
    var increaseInput = modalBody.querySelector("[data-settlement-increase]");
    var decreaseInput = modalBody.querySelector("[data-settlement-decrease]");
    var noteInput = modalBody.querySelector("[data-settlement-note]");
    var increaseAmount = increaseInput && increaseInput.value.trim() !== "" ? Number(increaseInput.value) : 0;
    var decreaseAmount = decreaseInput && decreaseInput.value.trim() !== "" ? Number(decreaseInput.value) : 0;
    if (!Number.isFinite(increaseAmount) || !Number.isFinite(decreaseAmount) || increaseAmount < 0 || decreaseAmount < 0) {
      return { valid: false, message: "增加金额和减少金额必须是大于等于 0 的数字。" };
    }
    var payable = settlementPayable(systemPayable, increaseAmount, decreaseAmount);
    if (payable < 0) {
      return { valid: false, message: "减少金额不能大于系统应付金额与增加金额之和。" };
    }
    return {
      valid: true,
      increaseAmount: round(increaseAmount),
      decreaseAmount: round(decreaseAmount),
      adjustmentNote: noteInput ? noteInput.value.trim() : "",
      payable: payable
    };
  }

  function showSettlementFormError(message) {
    var error = modalBody.querySelector("[data-settlement-error]");
    if (!error) return;
    error.textContent = message || "";
    error.hidden = !message;
  }

  function updateSettlementPayablePreview() {
    var preview = modalBody.querySelector("[data-settlement-final-payable]");
    if (!preview) return;
    var values = readSettlementAdjustmentInputs(Number(preview.dataset.systemPayable));
    preview.textContent = values.valid ? money(values.payable, preview.dataset.currency) : "—";
    preview.classList.toggle("is-invalid", !values.valid);
  }

  function renderSettlement() {
    var rows = filterBySearch(data.settlements.filter(rowMatchesCommon));
    var p = paginate(rows, 12);
    pageEl.innerHTML = toolbar('<select><option>全部结算状态</option><option>待付款</option><option>部分付款</option><option>已付款</option></select><button class="button button-primary" data-open-settlement-create>创建结算单</button>') +
      '<section class="page-section">' + panel("工厂结算列表", "结算单由已对账账单手动生成；调整金额在标记付款后锁定", settlementTable(p.rows) + p.html) + '</section>';
  }

  function eligibleSettlementBills() {
    return data.bills.filter(function (bill) {
      var ready = bill.status === "已对账" || bill.status === "待结算";
      var exists = data.settlements.some(function (settlement) { return settlement.billId === bill.id; });
      return ready && !exists;
    });
  }

  function openSettlementCreateModal(preferredBillId) {
    var eligible = eligibleSettlementBills();
    var bill = eligible.find(function (item) { return item.id === preferredBillId; }) || eligible[0];
    if (!bill) {
      openModal("手动生成", "创建工厂结算单", '<div class="empty"><div><h3>暂无可结算账单</h3><p>只有已完成对账且尚未生成结算单的工厂账单可以选择。</p><p style="margin-top:12px"><button class="button button-secondary" data-go="reconcile">返回对账工作台</button></p></div></div>');
      return;
    }
    var options = eligible.map(function (item) {
      return '<option value="' + esc(item.id) + '"' + (item.id === bill.id ? " selected" : "") + '>' + esc(item.id + " / " + item.supplier + " / " + item.period) + '</option>';
    }).join("");
    openModal("手动生成", "创建工厂结算单",
      '<div class="toolbar"><label><span>待结算账单</span><select data-settlement-bill>' + options + '</select></label></div>' +
      '<section class="drawer-section"><h3>结算信息确认</h3>' + summary([["工厂", esc(bill.supplier)], ["账单号", esc(bill.id)], ["结算期间", esc(bill.period)], ["系统应付金额", money(bill.systemPayable, bill.currency)]]) +
      '<p class="currency-policy"><strong>金额口径</strong><span>以对账确认后的采购单系统金额合计为准，不使用工厂账单金额覆盖。</span></p>' +
      settlementAdjustmentForm({ systemPayable: bill.systemPayable, increaseAmount: 0, decreaseAmount: 0, adjustmentNote: "", currency: bill.currency }) +
      '<div class="drawer-actions"><button class="button button-primary" data-create-settlement="' + esc(bill.id) + '">确认生成结算单</button><button class="button button-secondary" data-close-modal>取消</button></div></section>');
  }

  function createSettlement(billId) {
    var bill = data.bills.find(function (item) { return item.id === billId; });
    var existing = data.settlements.find(function (item) { return item.billId === billId; });
    if (!bill || (bill.status !== "已对账" && bill.status !== "待结算")) {
      toast("该账单尚未完成对账，不能生成结算单");
      return;
    }
    if (existing) {
      toast("该账单已存在结算单：" + existing.id);
      return;
    }
    var adjustments = readSettlementAdjustmentInputs(bill.systemPayable);
    if (!adjustments.valid) {
      showSettlementFormError(adjustments.message);
      return;
    }
    var sequence = data.settlements.reduce(function (max, item) {
      var current = Number(String(item.id).slice(-4)) || 0;
      return Math.max(max, current);
    }, 0) + 1;
    var settlementNo = "SET-202608-" + String(sequence).padStart(4, "0");
    data.settlements.unshift({
      id: settlementNo,
      supplier: bill.supplier,
      billId: bill.id,
      period: bill.period,
      currency: bill.currency,
      systemPayable: bill.systemPayable,
      increaseAmount: adjustments.increaseAmount,
      decreaseAmount: adjustments.decreaseAmount,
      adjustmentNote: adjustments.adjustmentNote,
      payable: adjustments.payable,
      paid: 0,
      unpaid: adjustments.payable,
      reconcileStatus: "已对账",
      settlementStatus: "待付款",
      creator: "王敏",
      createdAt: currentDateTime(),
      updatedBy: "王敏",
      updatedAt: currentDateTime(),
      paidAt: "—"
    });
    bill.status = "待结算";
    recordOperationLog({
      category: "结算操作",
      action: "生成工厂结算单",
      targetType: "工厂结算单",
      targetId: settlementNo,
      values: [
        operationValue("工厂账单", "—", bill.id),
        operationValue("系统应付金额", "—", money(bill.systemPayable, bill.currency)),
        operationValue("增加金额", "—", money(adjustments.increaseAmount, bill.currency)),
        operationValue("减少金额", "—", money(adjustments.decreaseAmount, bill.currency)),
        operationValue("最终应付金额", "—", money(adjustments.payable, bill.currency)),
        operationValue("调整备注", "—", adjustments.adjustmentNote || "未填写")
      ]
    });
    navigate("settlement");
    toast("已生成结算单：" + settlementNo);
  }

  function openSettlementEditModal(settlementId) {
    var settlement = data.settlements.find(function (item) { return item.id === settlementId; });
    if (!settlement) return;
    if (settlementAdjustmentsLocked(settlement)) {
      toast("该结算单已标记付款，调整金额和备注不可修改");
      return;
    }
    openModal("付款前调整", "编辑工厂结算单",
      summary([["结算单号", esc(settlement.id)], ["工厂", esc(settlement.supplier)], ["系统应付金额", money(settlement.systemPayable, settlement.currency)], ["当前状态", tag(settlement.settlementStatus)]]) +
      '<section class="drawer-section"><h3>结算调整</h3>' + settlementAdjustmentForm(settlement) +
      '<div class="drawer-actions"><button class="button button-primary" data-update-settlement="' + esc(settlement.id) + '">保存调整</button><button class="button button-secondary" data-close-modal>取消</button></div></section>');
  }

  function updateSettlementAdjustments(settlementId) {
    var settlement = data.settlements.find(function (item) { return item.id === settlementId; });
    if (!settlement) return;
    if (settlementAdjustmentsLocked(settlement)) {
      showSettlementFormError("该结算单已标记付款，付款后禁止修改。");
      return;
    }
    var adjustments = readSettlementAdjustmentInputs(settlement.systemPayable);
    if (!adjustments.valid) {
      showSettlementFormError(adjustments.message);
      return;
    }
    var previousIncrease = settlement.increaseAmount;
    var previousDecrease = settlement.decreaseAmount;
    var previousNote = settlement.adjustmentNote || "未填写";
    var previousPayable = settlement.payable;
    settlement.increaseAmount = adjustments.increaseAmount;
    settlement.decreaseAmount = adjustments.decreaseAmount;
    settlement.adjustmentNote = adjustments.adjustmentNote;
    settlement.payable = adjustments.payable;
    settlement.unpaid = round(adjustments.payable - settlement.paid);
    settlement.updatedBy = "王敏";
    settlement.updatedAt = currentDateTime();
    recordOperationLog({
      category: "结算操作",
      action: "修改工厂结算单",
      targetType: "工厂结算单",
      targetId: settlement.id,
      values: [
        operationValue("增加金额", money(previousIncrease, settlement.currency), money(settlement.increaseAmount, settlement.currency)),
        operationValue("减少金额", money(previousDecrease, settlement.currency), money(settlement.decreaseAmount, settlement.currency)),
        operationValue("最终应付金额", money(previousPayable, settlement.currency), money(settlement.payable, settlement.currency)),
        operationValue("调整备注", previousNote, settlement.adjustmentNote || "未填写")
      ]
    });
    closeModal();
    closeDrawer();
    render();
    toast("已更新结算调整：" + settlement.id);
  }

  function openSettlementPaymentModal(settlementId) {
    var settlement = data.settlements.find(function (item) { return item.id === settlementId; });
    if (!settlement || settlementAdjustmentsLocked(settlement)) return;
    openModal("二次确认", "标记结算单付款",
      '<p>确认付款后，增加金额、减少金额和备注将锁定且不可修改。</p>' +
      '<section class="drawer-section"><h3>付款信息</h3>' + summary([["结算单号", esc(settlement.id)], ["系统应付金额", money(settlement.systemPayable, settlement.currency)], ["调整后应付", money(settlement.payable, settlement.currency)], ["本次付款", money(settlement.unpaid, settlement.currency)]]) +
      '<label class="form-field payment-note"><span>付款备注</span><textarea maxlength="200" data-settlement-payment-note placeholder="填写付款凭据或说明"></textarea></label>' +
      '<div class="drawer-actions"><button class="button button-primary" data-mark-settlement-paid="' + esc(settlement.id) + '">确认标记付款</button><button class="button button-secondary" data-close-modal>取消</button></div></section>');
  }

  function markSettlementPaid(settlementId) {
    var settlement = data.settlements.find(function (item) { return item.id === settlementId; });
    if (!settlement || settlementAdjustmentsLocked(settlement)) {
      toast("该结算单已完成付款，不能重复标记");
      return;
    }
    var noteInput = modalBody.querySelector("[data-settlement-payment-note]");
    var paymentAmount = settlement.unpaid;
    var previousStatus = settlement.settlementStatus;
    settlement.paymentNote = noteInput ? noteInput.value.trim() : "";
    settlement.paid = settlement.payable;
    settlement.unpaid = 0;
    settlement.settlementStatus = "已付款";
    settlement.paidAt = currentDateTime();
    settlement.updatedBy = "王敏";
    settlement.updatedAt = settlement.paidAt;
    var bill = data.bills.find(function (item) { return item.id === settlement.billId; });
    if (bill) bill.status = "已结算";
    recordOperationLog({
      category: "付款操作",
      action: "标记工厂结算单付款",
      targetType: "工厂结算单",
      targetId: settlement.id,
      values: [
        operationValue("付款金额", "—", money(paymentAmount, settlement.currency)),
        operationValue("操作前状态", previousStatus, settlement.settlementStatus),
        operationValue("未付金额", money(paymentAmount, settlement.currency), money(0, settlement.currency)),
        operationValue("付款时间", "—", settlement.paidAt),
        operationValue("付款备注", "—", settlement.paymentNote || "未填写")
      ]
    });
    closeModal();
    closeDrawer();
    render();
    toast("已标记付款，结算调整已锁定：" + settlement.id);
  }

  function settlementTable(rows) {
    return '<div class="table-wrap settlement-table"><table><thead><tr><th>结算单号</th><th>工厂</th><th>账单号</th><th>账期</th><th>币种</th><th class="num">系统应付金额</th><th class="num">增加金额</th><th class="num">减少金额</th><th class="num">最终应付</th><th>备注</th><th class="num">已付金额</th><th class="num">未付金额</th><th>对账状态</th><th>结算状态</th><th>创建人</th><th>创建时间</th><th>付款时间</th><th class="sticky-action">操作</th></tr></thead><tbody>' +
      rows.map(function (s) {
        var locked = settlementAdjustmentsLocked(s);
        var editAction = locked
          ? '<button class="link-button" disabled title="付款后不可修改">付款后不可修改</button>'
          : '<button class="link-button" data-open-settlement-edit="' + esc(s.id) + '">编辑</button>';
        var paymentAction = locked
          ? '<button class="link-button" disabled>已付款</button>'
          : '<button class="link-button" data-open-settlement-payment="' + esc(s.id) + '">标记付款</button>';
        return '<tr><td>' + esc(s.id) + '</td><td>' + esc(s.supplier) + '</td><td>' + esc(s.billId) + '</td><td>' + esc(s.period) + '</td><td>' + esc(s.currency) + '</td><td class="num">' + money(s.systemPayable, s.currency) + '</td><td class="num amount-positive">' + money(s.increaseAmount, s.currency) + '</td><td class="num amount-negative">' + money(s.decreaseAmount, s.currency) + '</td><td class="num"><strong>' + money(s.payable, s.currency) + '</strong></td><td class="settlement-note" title="' + esc(s.adjustmentNote || "—") + '">' + esc(s.adjustmentNote || "—") + '</td><td class="num">' + money(s.paid, s.currency) + '</td><td class="num">' + money(s.unpaid, s.currency) + '</td><td>' + tag(s.reconcileStatus) + '</td><td>' + tag(s.settlementStatus) + '</td><td>' + esc(s.creator) + '</td><td>' + esc(s.createdAt) + '</td><td>' + esc(s.paidAt) + '</td><td class="sticky-action"><button class="link-button" data-open-settlement="' + esc(s.id) + '">详情</button> · ' + editAction + ' · ' + paymentAction + '</td></tr>';
      }).join("") + '</tbody></table></div>';
  }

  function renderLogisticsSettlement() {
    var rows = applyPageFilters(filterBySearch(data.logisticsSettlements.filter(rowMatchesCommon)));
    var p = paginate(rows, 12);
    var billOptions = '<select data-page-filter="logisticsBillId"><option value="all">全部物流账单</option>' + data.logisticsBills.map(function (bill) {
      return '<option value="' + esc(bill.id) + '"' + (state.pageFilters.logisticsBillId === bill.id ? " selected" : "") + '>' + esc(bill.id + " / " + bill.carrier + " / " + bill.originalCurrency) + '</option>';
    }).join("") + '</select>';
    pageEl.innerHTML = toolbar(billOptions + selectPage("settled", ["全部结算状态", "待付款", "部分付款", "已付款"], state.pageFilters.settled || "all") + '<button class="button button-primary" data-open-logistics-settlement-create>创建物流结算单</button>') +
      '<section class="page-section">' + panel("物流结算列表", "由已完成对账的物流账单手动生成；调整使用账单原币，人民币按账单汇率快照折算", logisticsSettlementTable(p.rows) + p.html) + '</section>';
  }

  function eligibleLogisticsSettlementBills() {
    return data.logisticsBills.filter(function (bill) {
      var ready = bill.status === "已完成" || bill.status === "待结算";
      var exists = data.logisticsSettlements.some(function (settlement) { return settlement.billId === bill.id; });
      return ready && !exists;
    });
  }

  function openLogisticsSettlementCreateModal(preferredBillId) {
    var eligible = eligibleLogisticsSettlementBills();
    var bill = eligible.find(function (item) { return item.id === preferredBillId; }) || eligible[0];
    if (!bill) {
      openModal("手动生成", "创建物流结算单", '<div class="empty"><div><h3>暂无可结算物流账单</h3><p>只有已完成物流成本对账且尚未生成结算单的账单可以选择。</p><p style="margin-top:12px"><button class="button button-secondary" data-go="logisticsReconcile">返回物流成本对账</button></p></div></div>');
      return;
    }
    var options = eligible.map(function (item) {
      return '<option value="' + esc(item.id) + '"' + (item.id === bill.id ? " selected" : "") + '>' + esc(item.id + " / " + item.carrier + " / " + item.originalCurrency) + '</option>';
    }).join("");
    openModal("手动生成", "创建物流结算单",
      '<div class="toolbar"><label><span>待结算物流账单</span><select data-logistics-settlement-bill>' + options + '</select></label></div>' +
      '<section class="drawer-section"><h3>结算信息确认</h3>' + summary([["物流商", esc(bill.carrier)], ["物流账单", esc(bill.id)], ["结算原币", esc(bill.originalCurrency)], ["对账确认金额", money(bill.actualTotal, bill.originalCurrency)]]) +
      '<p class="currency-policy"><strong>金额口径</strong><span>增加金额和减少金额均使用账单原币；最终应付按账单汇率快照 ' + bill.exchangeRate.toFixed(4) + ' 折算人民币。</span></p>' +
      settlementAdjustmentForm({ systemPayable: bill.actualTotal, increaseAmount: 0, decreaseAmount: 0, adjustmentNote: "", currency: bill.originalCurrency }) +
      '<div class="drawer-actions"><button class="button button-primary" data-create-logistics-settlement="' + esc(bill.id) + '">确认生成物流结算单</button><button class="button button-secondary" data-close-modal>取消</button></div></section>');
  }

  function createLogisticsSettlement(billId) {
    var bill = data.logisticsBills.find(function (item) { return item.id === billId; });
    var existing = data.logisticsSettlements.find(function (item) { return item.billId === billId; });
    if (!bill || (bill.status !== "已完成" && bill.status !== "待结算")) {
      toast("该物流账单尚未完成对账，不能生成结算单");
      return;
    }
    if (existing) {
      toast("该物流账单已存在结算单：" + existing.id);
      return;
    }
    var adjustments = readSettlementAdjustmentInputs(bill.actualTotal);
    if (!adjustments.valid) {
      showSettlementFormError(adjustments.message);
      return;
    }
    var sequence = data.logisticsSettlements.reduce(function (max, item) {
      var current = Number(String(item.id).slice(-4)) || 0;
      return Math.max(max, current);
    }, 0) + 1;
    var settlementNo = "LSET-202608-" + String(sequence).padStart(4, "0");
    data.logisticsSettlements.unshift({
      id: settlementNo,
      carrier: bill.carrier,
      billId: bill.id,
      period: bill.period,
      currency: bill.originalCurrency,
      originalCurrency: bill.originalCurrency,
      exchangeRate: bill.exchangeRate,
      rateDate: bill.rateDate,
      rateSource: bill.rateSource,
      baseCurrency: bill.baseCurrency,
      systemPayable: bill.actualTotal,
      increaseAmount: adjustments.increaseAmount,
      decreaseAmount: adjustments.decreaseAmount,
      adjustmentNote: adjustments.adjustmentNote,
      payable: adjustments.payable,
      payableCny: round(adjustments.payable * bill.exchangeRate),
      paid: 0,
      unpaid: adjustments.payable,
      reconcileStatus: "已完成",
      settlementStatus: "待付款",
      creator: "王敏",
      createdAt: currentDateTime(),
      updatedBy: "王敏",
      updatedAt: currentDateTime(),
      paidAt: "—"
    });
    bill.status = "待结算";
    recordOperationLog({
      category: "结算操作",
      action: "生成物流结算单",
      targetType: "物流结算单",
      targetId: settlementNo,
      values: [
        operationValue("物流账单", "—", bill.id),
        operationValue("原始币种", "—", bill.originalCurrency),
        operationValue("对账确认金额", "—", money(bill.actualTotal, bill.originalCurrency)),
        operationValue("增加金额", "—", money(adjustments.increaseAmount, bill.originalCurrency)),
        operationValue("减少金额", "—", money(adjustments.decreaseAmount, bill.originalCurrency)),
        operationValue("原币最终应付", "—", money(adjustments.payable, bill.originalCurrency)),
        operationValue("人民币折算金额", "—", money(round(adjustments.payable * bill.exchangeRate), bill.baseCurrency)),
        operationValue("调整备注", "—", adjustments.adjustmentNote || "未填写")
      ]
    });
    navigate("logisticsSettlement", { logisticsBillId: bill.id });
    toast("已生成物流结算单：" + settlementNo);
  }

  function openLogisticsSettlementEditModal(settlementId) {
    var settlement = data.logisticsSettlements.find(function (item) { return item.id === settlementId; });
    if (!settlement) return;
    if (settlementAdjustmentsLocked(settlement)) {
      toast("该物流结算单已标记付款，调整金额和备注不可修改");
      return;
    }
    openModal("付款前调整", "编辑物流结算单",
      summary([["物流结算单号", esc(settlement.id)], ["物流商", esc(settlement.carrier)], ["原始币种", esc(settlement.originalCurrency)], ["对账确认金额", money(settlement.systemPayable, settlement.originalCurrency)]]) +
      '<section class="drawer-section"><h3>结算调整</h3>' + settlementAdjustmentForm(settlement) +
      '<div class="drawer-actions"><button class="button button-primary" data-update-logistics-settlement="' + esc(settlement.id) + '">保存调整</button><button class="button button-secondary" data-close-modal>取消</button></div></section>');
  }

  function updateLogisticsSettlementAdjustments(settlementId) {
    var settlement = data.logisticsSettlements.find(function (item) { return item.id === settlementId; });
    if (!settlement) return;
    if (settlementAdjustmentsLocked(settlement)) {
      showSettlementFormError("该物流结算单已标记付款，付款后禁止修改。");
      return;
    }
    var adjustments = readSettlementAdjustmentInputs(settlement.systemPayable);
    if (!adjustments.valid) {
      showSettlementFormError(adjustments.message);
      return;
    }
    var previousIncrease = settlement.increaseAmount;
    var previousDecrease = settlement.decreaseAmount;
    var previousNote = settlement.adjustmentNote || "未填写";
    var previousPayable = settlement.payable;
    var previousPayableCny = settlement.payableCny;
    settlement.increaseAmount = adjustments.increaseAmount;
    settlement.decreaseAmount = adjustments.decreaseAmount;
    settlement.adjustmentNote = adjustments.adjustmentNote;
    settlement.payable = adjustments.payable;
    settlement.payableCny = round(adjustments.payable * settlement.exchangeRate);
    settlement.unpaid = round(adjustments.payable - settlement.paid);
    settlement.updatedBy = "王敏";
    settlement.updatedAt = currentDateTime();
    recordOperationLog({
      category: "结算操作",
      action: "修改物流结算单",
      targetType: "物流结算单",
      targetId: settlement.id,
      values: [
        operationValue("增加金额", money(previousIncrease, settlement.originalCurrency), money(settlement.increaseAmount, settlement.originalCurrency)),
        operationValue("减少金额", money(previousDecrease, settlement.originalCurrency), money(settlement.decreaseAmount, settlement.originalCurrency)),
        operationValue("原币最终应付", money(previousPayable, settlement.originalCurrency), money(settlement.payable, settlement.originalCurrency)),
        operationValue("人民币折算金额", money(previousPayableCny, settlement.baseCurrency), money(settlement.payableCny, settlement.baseCurrency)),
        operationValue("调整备注", previousNote, settlement.adjustmentNote || "未填写")
      ]
    });
    closeModal();
    closeDrawer();
    render();
    toast("已更新物流结算调整：" + settlement.id);
  }

  function openLogisticsSettlementPaymentModal(settlementId) {
    var settlement = data.logisticsSettlements.find(function (item) { return item.id === settlementId; });
    if (!settlement || settlementAdjustmentsLocked(settlement)) return;
    openModal("二次确认", "标记物流结算单付款",
      '<p>确认付款后，增加金额、减少金额和备注将锁定且不可修改。</p>' +
      '<section class="drawer-section"><h3>付款信息</h3>' + summary([["物流结算单号", esc(settlement.id)], ["原币最终应付", money(settlement.payable, settlement.originalCurrency)], ["人民币折算金额", money(settlement.payableCny, settlement.baseCurrency)], ["本次付款", money(settlement.unpaid, settlement.originalCurrency)]]) +
      '<label class="form-field payment-note"><span>付款备注</span><textarea maxlength="200" data-logistics-settlement-payment-note placeholder="填写付款凭据或说明"></textarea></label>' +
      '<div class="drawer-actions"><button class="button button-primary" data-mark-logistics-settlement-paid="' + esc(settlement.id) + '">确认标记付款</button><button class="button button-secondary" data-close-modal>取消</button></div></section>');
  }

  function markLogisticsSettlementPaid(settlementId) {
    var settlement = data.logisticsSettlements.find(function (item) { return item.id === settlementId; });
    if (!settlement || settlementAdjustmentsLocked(settlement)) {
      toast("该物流结算单已完成付款，不能重复标记");
      return;
    }
    var noteInput = modalBody.querySelector("[data-logistics-settlement-payment-note]");
    var paymentAmount = settlement.unpaid;
    var paymentAmountCny = round(paymentAmount * settlement.exchangeRate);
    var previousStatus = settlement.settlementStatus;
    settlement.paymentNote = noteInput ? noteInput.value.trim() : "";
    settlement.paid = settlement.payable;
    settlement.unpaid = 0;
    settlement.settlementStatus = "已付款";
    settlement.paidAt = currentDateTime();
    settlement.updatedBy = "王敏";
    settlement.updatedAt = settlement.paidAt;
    var bill = data.logisticsBills.find(function (item) { return item.id === settlement.billId; });
    if (bill) bill.status = "已结算";
    recordOperationLog({
      category: "付款操作",
      action: "标记物流结算单付款",
      targetType: "物流结算单",
      targetId: settlement.id,
      values: [
        operationValue("原币付款金额", "—", money(paymentAmount, settlement.originalCurrency)),
        operationValue("付款金额", "—", money(paymentAmountCny, settlement.baseCurrency)),
        operationValue("操作前状态", previousStatus, settlement.settlementStatus),
        operationValue("未付金额", money(paymentAmount, settlement.originalCurrency), money(0, settlement.originalCurrency)),
        operationValue("付款时间", "—", settlement.paidAt),
        operationValue("付款备注", "—", settlement.paymentNote || "未填写")
      ]
    });
    closeModal();
    closeDrawer();
    render();
    toast("已标记付款，物流结算调整已锁定：" + settlement.id);
  }

  function logisticsSettlementTable(rows) {
    return '<div class="table-wrap settlement-table"><table><thead><tr><th>物流结算单号</th><th>物流商</th><th>物流账单</th><th>账期</th><th>原始币种</th><th class="num">对账确认金额</th><th class="num">增加金额</th><th class="num">减少金额</th><th class="num">原币最终应付</th><th class="num">人民币折算金额</th><th>备注</th><th class="num">未付金额</th><th>结算状态</th><th>创建时间</th><th>付款时间</th><th class="sticky-action">操作</th></tr></thead><tbody>' +
      rows.map(function (settlement) {
        var locked = settlementAdjustmentsLocked(settlement);
        var editAction = locked ? '<button class="link-button" disabled title="付款后不可修改">付款后不可修改</button>' : '<button class="link-button" data-open-logistics-settlement-edit="' + esc(settlement.id) + '">编辑</button>';
        var paymentAction = locked ? '<button class="link-button" disabled>已付款</button>' : '<button class="link-button" data-open-logistics-settlement-payment="' + esc(settlement.id) + '">标记付款</button>';
        return '<tr><td>' + esc(settlement.id) + '</td><td>' + esc(settlement.carrier) + '</td><td>' + esc(settlement.billId) + '</td><td>' + esc(settlement.period) + '</td><td>' + esc(settlement.originalCurrency) + '</td><td class="num">' + money(settlement.systemPayable, settlement.originalCurrency) + '</td><td class="num amount-positive">' + money(settlement.increaseAmount, settlement.originalCurrency) + '</td><td class="num amount-negative">' + money(settlement.decreaseAmount, settlement.originalCurrency) + '</td><td class="num"><strong>' + money(settlement.payable, settlement.originalCurrency) + '</strong></td><td class="num">' + money(settlement.payableCny, settlement.baseCurrency) + '</td><td class="settlement-note" title="' + esc(settlement.adjustmentNote || "—") + '">' + esc(settlement.adjustmentNote || "—") + '</td><td class="num">' + money(settlement.unpaid, settlement.originalCurrency) + '</td><td>' + tag(settlement.settlementStatus) + '</td><td>' + esc(settlement.createdAt) + '</td><td>' + esc(settlement.paidAt) + '</td><td class="sticky-action"><button class="link-button" data-open-logistics-settlement="' + esc(settlement.id) + '">详情</button> · ' + editAction + ' · ' + paymentAction + '</td></tr>';
      }).join("") + '</tbody></table></div>';
  }

  function renderLogisticsBills() {
    var rows = applyPageFilters(filterBySearch(data.logisticsBills.filter(rowMatchesCommon)));
    var p = paginate(rows, 12);
    pageEl.innerHTML = logisticsCurrencySummary(rows, "totalAmount", "totalAmountCny", "账单金额") +
      '<section class="page-section">' + toolbar('<select><option>全部物流商</option><option>USPS</option><option>UPS</option><option>FedEx</option><option>DHL</option></select><button class="button button-primary" data-open-logistics-import>导入物流账单</button>') + '</section>' +
      '<section class="page-section">' + panel("物流账单列表", "按物流商 + 原始币种拆分账单；原币核对，人民币入账", logisticsBillsTable(p.rows) + p.html) + '</section>';
  }
  function logisticsBillsTable(rows) {
    return '<div class="table-wrap table-tall"><table><thead><tr><th>账单 ID</th><th>物流商</th><th>物流账单号</th><th>账期</th><th>原始币种</th><th class="num">记账汇率</th><th class="num">总条数</th><th class="num">账单原币总金额</th><th class="num">账单人民币折算金额</th><th class="num">自动匹配</th><th class="num">未匹配</th><th class="num">重复</th><th class="num">成本偏差异常</th><th class="num">原币预估总成本</th><th class="num">原币实际总成本</th><th class="num">原币总差额</th><th>当前状态</th><th>导入人</th><th>导入时间</th><th class="sticky-action">操作</th></tr></thead><tbody>' +
      rows.map(function (b) {
        return '<tr><td>' + esc(b.id) + '</td><td>' + esc(b.carrier) + '</td><td>' + esc(b.billNo) + '</td><td>' + esc(b.period) + '</td><td>' + esc(b.originalCurrency) + '</td><td class="num">' + b.exchangeRate.toFixed(4) + '</td><td class="num">' + b.totalLines + '</td><td class="num">' + money(b.totalAmount, b.originalCurrency) + '</td><td class="num">' + money(b.totalAmountCny, b.baseCurrency) + '</td><td class="num">' + b.autoMatched + '</td><td class="num">' + b.unmatched + '</td><td class="num">' + b.duplicated + '</td><td class="num">' + b.costAbnormal + '</td><td class="num">' + money(b.estimatedTotal, b.originalCurrency) + '</td><td class="num">' + money(b.actualTotal, b.originalCurrency) + '</td><td class="num">' + money(b.diff, b.originalCurrency) + '</td><td>' + tag(b.status) + '</td><td>' + esc(b.importer) + '</td><td>' + esc(b.importedAt) + '</td><td class="sticky-action"><button class="link-button" data-open-logistics-bill="' + esc(b.id) + '">详情</button> · <button class="link-button" data-logistics-bill="' + esc(b.id) + '">对账</button> · <button class="link-button" data-logistics-costs-bill="' + esc(b.id) + '">查看成本</button></td></tr>';
      }).join("") + '</tbody></table></div>';
  }

  function logisticsImportModalContent() {
    return importModalContent("logistics");
  }
  function openLogisticsImportModal(resetStep) {
    if (resetStep !== false) resetImportWorkflow("logistics");
    modal.dataset.view = "logisticsImport";
    openModal("物流账单", "导入物流账单", logisticsImportModalContent());
  }
  function importLogisticsBody() {
    return importWorkflowBody("logistics");
  }

  function renderLogisticsReconcile() {
    var selectableBills = data.logisticsBills.filter(rowMatchesCommon);
    var bill = selectableBills.find(function (b) { return b.id === state.logisticsRecon.selectedBill; }) || selectableBills[0] || data.logisticsBills[0];
    state.logisticsRecon.selectedBill = bill.id;
    var tabs = ["全部", "自动匹配", "成本正常", "成本异常", "严重偏差", "未匹配", "重复"];
    var billLines = data.logisticsReconcileLines.filter(function (l) { return l.billId === bill.id; });
    var lines = billLines.filter(function (l) { return state.logisticsRecon.tab === "全部" || l.matchStatus === state.logisticsRecon.tab; });
    lines = filterBySearch(lines);
    var p = paginate(lines, 12);
    var avgRate = bill.estimatedTotal ? ((bill.actualTotal - bill.estimatedTotal) / bill.estimatedTotal * 100).toFixed(2) + "%" : "0%";
    var existingSettlement = data.logisticsSettlements.find(function (settlement) { return settlement.billId === bill.id; });
    var settlementReady = bill.status === "已完成" || bill.status === "待结算";
    var settlementAction = existingSettlement
      ? '<button class="button button-secondary" data-view-logistics-settlement="' + esc(bill.id) + '">查看物流结算单</button>'
      : settlementReady
        ? '<button class="button button-primary" data-open-logistics-settlement-create="' + esc(bill.id) + '">生成物流结算单</button>'
        : '<button class="button button-secondary" disabled title="完成物流成本对账后才可生成结算单">生成物流结算单</button>';
    pageEl.innerHTML =
      '<section class="grid grid-6">' + kpi("物流商", bill.carrier, bill.id) + kpi("原始币种", bill.originalCurrency, "本账单仅汇总该币种") + kpi("总条数", bill.totalLines, "账单明细") + kpi("自动匹配", bill.autoMatched, "Tracking / 面单号") + kpi("成本异常", bill.costAbnormal, "偏差率 AND 绝对差额", "warn") + kpi("原币预估总成本", money(bill.estimatedTotal, bill.originalCurrency), "同币种汇总") + kpi("原币实际总成本", money(bill.actualTotal, bill.originalCurrency), "同币种汇总") + kpi("原币总差额", money(bill.diff, bill.originalCurrency), "实际 - 预估", bill.diff > 0 ? "warn" : "") + kpi("人民币实际成本", money(bill.actualTotalCny, bill.baseCurrency), "用于财务入账与毛利") + kpi("记账汇率", bill.exchangeRate.toFixed(4), bill.rateDate + " / " + bill.rateSource) + kpi("平均偏差率", avgRate, "原币差额 / 原币预估") + '</section>' +
      '<section class="page-section">' + logisticsTabs(tabs, billLines) + '</section>' +
      '<section class="page-section">' + toolbar('<select data-logistics-selected-bill>' + selectableBills.map(function (b) { return '<option value="' + esc(b.id) + '"' + (b.id === state.logisticsRecon.selectedBill ? " selected" : "") + '>' + esc(b.id + " / " + b.carrier + " / " + b.originalCurrency) + '</option>'; }).join("") + '</select>' + settlementAction) + '</section>' +
      '<section class="page-section">' + panel("物流成本对账明细", "原币内计算偏差；人民币金额仅用于入账、跨币种分析与订单毛利", logisticsReconTable(p.rows) + p.html) + '</section>';
  }
  function logisticsTabs(tabs, rows) {
    return '<div class="tabs">' + tabs.map(function (t) {
      var count = t === "全部" ? rows.length : rows.filter(function (l) { return l.matchStatus === t; }).length;
      return '<button class="tab ' + (state.logisticsRecon.tab === t ? "is-active" : "") + '" data-logistics-tab="' + esc(t) + '" aria-pressed="' + (state.logisticsRecon.tab === t ? "true" : "false") + '"><span class="tab-label">' + esc(t) + '</span><b class="tab-count">' + count + '</b></button>';
    }).join("") + '</div>';
  }
  function logisticsReconTable(rows) {
    return '<div class="table-wrap table-tall"><table><thead><tr><th>行号</th><th>Tracking Number</th><th>平台订单号</th><th>面单号</th><th>SKU</th><th class="num">数量</th><th>工厂</th><th>物流渠道</th><th>国家</th><th>原始币种</th><th class="num">原币预估成本</th><th class="num">原币实际成本</th><th class="num">原币差额</th><th class="num">偏差率</th><th class="num">记账汇率</th><th class="num">人民币实际成本</th><th class="num">人民币差额</th><th class="num">预估重量</th><th class="num">实际重量</th><th class="num">计费重量</th><th>异常等级</th><th>匹配状态</th><th class="sticky-action">操作</th></tr></thead><tbody>' +
      rows.map(function (l) {
        return '<tr><td>' + l.lineNo + '</td><td>' + esc(l.tracking) + '</td><td>' + esc(l.orderId) + '</td><td>' + esc(l.labelNo) + '</td><td>' + esc(l.sku) + '</td><td class="num">' + l.qty + '</td><td>' + esc(l.supplier) + '</td><td>' + esc(l.channel) + '</td><td>' + esc(l.country) + '</td><td>' + esc(l.originalCurrency) + '</td><td class="num">' + money(l.estimatedCost, l.originalCurrency) + '</td><td class="num">' + money(l.actualCost, l.originalCurrency) + '</td><td class="num">' + money(l.diff, l.originalCurrency) + '</td><td class="num">' + l.diffRate.toFixed(2) + '%</td><td class="num">' + l.exchangeRate.toFixed(4) + '</td><td class="num">' + money(l.actualCostCny, l.baseCurrency) + '</td><td class="num">' + money(l.diffCny, l.baseCurrency) + '</td><td class="num">' + l.estimatedWeight + 'kg</td><td class="num">' + l.actualWeight + 'kg</td><td class="num">' + l.billWeight + 'kg</td><td>' + tag(l.level) + '</td><td>' + tag(l.matchStatus) + '</td><td class="sticky-action"><button class="link-button" data-open-logistics-recon="' + l.lineNo + '">查看</button></td></tr>';
      }).join("") + '</tbody></table></div>';
  }

  function renderProfit() {
    var rows = filterBySearch(data.orders.filter(rowMatchesCommon));
    var p = paginate(rows, 12);
    pageEl.innerHTML = toolbar('<select><option>全部毛利区间</option><option>负毛利</option><option>低毛利</option><option>高毛利</option></select><select><option>是否有售后</option><option>是</option><option>否</option></select>') +
      '<section class="page-section">' + panel("订单利润（人民币）", "全部收入与成本统一按 CNY 核算；物流原币成本按账单汇率快照折算", profitTable(p.rows) + p.html) + '</section>';
  }
  function profitTable(rows) {
    return '<div class="table-wrap table-tall"><table><thead><tr><th>订单号</th><th>客户</th><th>下单时间</th><th>订单类型</th><th class="num">产品收入（CNY）</th><th class="num">物流收入（CNY）</th><th class="num">设计费（CNY）</th><th class="num">服务费（CNY）</th><th class="num">退款（CNY）</th><th class="num">净收入（CNY）</th><th class="num">工厂成本（CNY）</th><th class="num">物流成本（CNY）</th><th class="num">售后成本（CNY）</th><th class="num">原始毛利（CNY）</th><th class="num">含售后毛利（CNY）</th><th class="num">毛利率</th><th>利润状态</th><th>对账完成度</th><th class="sticky-action">操作</th></tr></thead><tbody>' +
      rows.map(function (o) {
        return '<tr><td>' + esc(o.id) + '</td><td>' + esc(o.customer) + '</td><td>' + esc(o.created) + '</td><td>' + tag(o.type) + '</td><td class="num">' + money(o.productIncome, o.currency) + '</td><td class="num">' + money(o.logisticsIncome, o.currency) + '</td><td class="num">' + money(o.designFee, o.currency) + '</td><td class="num">' + money(o.serviceFee, o.currency) + '</td><td class="num">' + money(o.refund, o.currency) + '</td><td class="num">' + money(o.netIncome, o.currency) + '</td><td class="num">' + money(o.factoryCost, o.currency) + '</td><td class="num">' + money(o.logisticsCost, o.currency) + '</td><td class="num">' + money(o.afterCost, o.currency) + '</td><td class="num">' + money(o.originalGross, o.currency) + '</td><td class="num">' + money(o.gross, o.currency) + '</td><td class="num">' + o.grossRate.toFixed(1) + '%</td><td>' + tag(o.profitStatus) + '</td><td>' + tag(o.reconciled) + '</td><td class="sticky-action"><button class="link-button" data-open-profit="' + esc(o.id) + '">利润详情</button></td></tr>';
      }).join("") + '</tbody></table></div>';
  }

  function renderSupplier() {
    var rows = data.suppliers.map(function (s) {
      var exp = data.expenses.filter(function (e) { return e.supplier === s; });
      var bills = data.bills.filter(function (b) { return b.supplier === s; });
      var diff = sum(bills, function (b) { return b.amountDiff; });
      var payable = sum(exp, function (e) { return e.amount; });
      return [s, exp.length, money(payable, data.baseCurrency), money(payable * .72, data.baseCurrency), money(payable * .28, data.baseCurrency), diff, (diff / Math.max(exp.length, 1) * 100).toFixed(1) + "%", exp.filter(function (e) { return e.external; }).length, money(exp.filter(function (e) { return e.external; }).length * 76, data.baseCurrency), money(payable * .68, data.baseCurrency), money(payable * .32, data.baseCurrency), '<button class="link-button" data-go="expense">下钻</button>'];
    });
    pageEl.innerHTML = '<section>' + panel("工厂报表", "按工厂查看采购单、对账、外部补录与结算", simpleTable(["工厂", "发货采购单", "系统应付", "已对账", "待对账", "差异数", "差异率", "外部补录数", "外部补录金额", "已结算", "未结算", "操作"], rows)) + '</section>';
  }

  function renderLogistics() {
    var rows = applyPageFilters(filterBySearch(data.logisticsCosts.filter(rowMatchesCommon)));
    var p = paginate(rows, 14);
    var billOptions = '<select data-page-filter="logisticsBillId"><option value="all">全部物流账单</option>' + data.logisticsBills.map(function (bill) {
      return '<option value="' + esc(bill.id) + '"' + (state.pageFilters.logisticsBillId === bill.id ? " selected" : "") + '>' + esc(bill.id + " / " + bill.carrier + " / " + bill.originalCurrency) + '</option>';
    }).join("") + '</select>';
    pageEl.innerHTML = logisticsCurrencySummary(rows, "actualCost", "actualCostCny", "实际成本") +
      '<section class="page-section">' + toolbar(billOptions + '<select><option>全部物流商</option><option>USPS</option><option>UPS</option><option>FedEx</option><option>DHL</option></select><select><option>全部实际账单状态</option><option>已匹配账单</option><option>无实际账单</option></select><select><option>全部异常等级</option><option>正常</option><option>轻微偏差</option><option>中度异常</option><option>严重异常</option><option>未匹配</option></select>') + '</section>' +
      '<section class="page-section">' + panel("物流成本", "原币用于账单核对和偏差分析，折算人民币成本用于财务入账和订单利润", logisticsTable(p.rows) + p.html) + '</section>';
  }
  function logisticsTable(rows) {
    return '<div class="table-wrap"><table><thead><tr><th>订单号</th><th>物流账单 ID</th><th>面单号</th><th>Tracking</th><th>物流商</th><th>报价表</th><th class="num">客户物流费用（CNY）</th><th>原始币种</th><th class="num">原币预估成本</th><th class="num">原币实际成本</th><th class="num">原币差额</th><th class="num">偏差率</th><th class="num">记账汇率</th><th class="num">人民币预估成本</th><th class="num">人民币实际成本</th><th class="num">人民币差额</th><th>创建时间</th><th>发货时间</th><th>实际账单状态</th><th>异常等级</th><th class="sticky-action">操作</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr><td>' + esc(r.orderId) + '</td><td>' + esc(r.billId) + '</td><td>' + esc(r.labelNo) + '</td><td>' + esc(r.tracking) + '</td><td>' + esc(r.carrier) + '</td><td>' + esc(r.rateCard) + '</td><td class="num">' + money(r.customerFee, r.customerFeeCurrency) + '</td><td>' + esc(r.originalCurrency) + '</td><td class="num">' + money(r.estimatedCost, r.originalCurrency) + '</td><td class="num">' + money(r.actualCost, r.originalCurrency) + '</td><td class="num">' + money(r.costDiff, r.originalCurrency) + '</td><td class="num">' + r.diffRate.toFixed(2) + '%</td><td class="num">' + r.exchangeRate.toFixed(4) + '</td><td class="num">' + money(r.estimatedCostCny, r.baseCurrency) + '</td><td class="num">' + money(r.actualCostCny, r.baseCurrency) + '</td><td class="num">' + money(r.costDiffCny, r.baseCurrency) + '</td><td>' + esc(r.createdAt) + '</td><td>' + esc(r.shippedAt) + '</td><td>' + tag(r.actualBillStatus) + '</td><td>' + tag(r.anomalyLevel) + '</td><td class="sticky-action"><button class="link-button" data-open-logistics-cost="' + esc(r.labelNo) + '">查看</button></td></tr>';
      }).join("") + '</tbody></table></div>';
  }

  function renderLogisticsReport() {
    var groups = {};
    data.logisticsBills.filter(rowMatchesCommon).forEach(function (bill) {
      var key = bill.carrier + "::" + bill.originalCurrency;
      if (!groups[key]) groups[key] = { carrier: bill.carrier, currency: bill.originalCurrency, bills: [] };
      groups[key].bills.push(bill);
    });
    var rows = Object.keys(groups).sort().map(function (key) {
      var group = groups[key];
      var billIds = group.bills.map(function (bill) { return bill.id; });
      var settlements = data.logisticsSettlements.filter(function (settlement) { return billIds.indexOf(settlement.billId) >= 0; });
      var actualOriginal = sum(group.bills, function (bill) { return bill.actualTotal; });
      var actualCny = sum(group.bills, function (bill) { return bill.actualTotalCny; });
      var payableOriginal = sum(settlements, function (settlement) { return settlement.payable; });
      var payableCny = sum(settlements, function (settlement) { return settlement.payableCny; });
      var paidOriginal = sum(settlements, function (settlement) { return settlement.paid; });
      return [esc(group.carrier), esc(group.currency), group.bills.length, sum(group.bills, function (bill) { return bill.totalLines; }), money(sum(group.bills, function (bill) { return bill.estimatedTotal; }), group.currency), money(actualOriginal, group.currency), money(actualOriginal - sum(group.bills, function (bill) { return bill.estimatedTotal; }), group.currency), money(actualCny, data.baseCurrency), settlements.length, money(payableOriginal, group.currency), money(payableCny, data.baseCurrency), money(paidOriginal, group.currency), '<button class="link-button" data-logistics-costs-bill="' + esc(group.bills[0].id) + '">查看成本</button>'];
    });
    pageEl.innerHTML = '<section>' + panel("物流报表", "按物流商 + 原始币种分行统计；原币不跨币种合并，人民币折算单独展示", simpleTable(["物流商", "原始币种", "账单数", "成本行数", "原币预估成本", "原币实际成本", "原币差额", "人民币实际成本", "结算单数", "原币最终应付", "人民币最终应付", "原币已付", "操作"], rows)) + '</section>';
  }

  function renderExceptions() {
    var rows = filterBySearch(data.exceptions.filter(rowMatchesCommon));
    var p = paginate(rows, 12);
    pageEl.innerHTML = toolbar('<select><option>全部异常类型</option><option>账单金额差异</option><option>平台缺单</option><option>多采购单匹配</option><option>重复账单</option><option>长时间未对账</option><option>长时间未结算</option></select>') +
      '<section class="page-section">' + panel("财务异常", "统一聚合对账、外部补录、结算等待办", exceptionsTable(p.rows) + p.html) + '</section>';
  }
  function exceptionsTable(rows) {
    return '<div class="table-wrap"><table><thead><tr><th>异常类型</th><th>工厂</th><th>订单号</th><th>采购单号</th><th>账单号</th><th class="num">金额</th><th>发生时间</th><th>状态</th><th>负责人</th><th>最后更新</th><th class="sticky-action">操作</th></tr></thead><tbody>' +
      rows.map(function (e) {
        return '<tr><td>' + esc(e.type) + '</td><td>' + esc(e.supplier) + '</td><td>' + esc(e.orderId) + '</td><td>' + esc(e.purchaseNo) + '</td><td>' + esc(e.billId) + '</td><td class="num">' + money(e.amount, e.currency) + '</td><td>' + esc(e.occurred) + '</td><td>' + tag(e.status) + '</td><td>' + esc(e.owner) + '</td><td>' + esc(e.updatedAt) + '</td><td class="sticky-action"><button class="link-button" data-open-exception="' + esc(e.id) + '">处理</button></td></tr>';
      }).join("") + '</tbody></table></div>';
  }

  function renderConfig() {
    pageEl.innerHTML = '<section class="grid grid-2"><div>' + panel("财务配置入口", "第一版仅保留入口，不实现复杂配置", simpleTable(["配置项", "当前值", "说明"], [["工厂报价快照", "启用", "采购单生成时记录当前报价"], ["账期规则", "导入时填写", "工厂账期不固定"], ["收入类型", "6 类", "后续可扩展"], ["支出类型", "7 类", "后续可扩展"], ["外部补录采购单", "启用", "需二次确认和操作日志"], ["操作日志", "仅追加", "所有导出和敏感操作必须写入"]])) + '</div><div>' + panel("审计要求", "导出全部留痕；敏感操作记录操作前后值", auditPolicy()) + '</div></section>';
  }
  function auditPolicy() {
    return '<div class="audit-log">' + ["全部数据导出", "工厂/物流账单导入", "保存字段或导出模板", "生成客户对账快照", "人工匹配与差异确认", "创建外部补录采购单", "关闭账单与处理异常", "生成或修改结算单", "标记工厂/物流付款"].map(function (name, i) {
      return '<div class="audit-item"><time>规则 ' + (i + 1) + '</time><strong>' + name + '</strong><span>' + tag(i === 0 ? "全部记录" : "记录专属值", i === 0 ? "blue" : "warn") + '</span></div>';
    }).join("") + '</div>';
  }

  function handleClick(event) {
    var el = event.target.closest("button");
    if (!el) return;
    if (el.dataset.go) navigate(el.dataset.go);
    if (el.dataset.kpiTarget) navigate(el.dataset.kpiTarget);
    if (el.dataset.clearSearch !== undefined) { state.table.q = ""; render(); }
    if (el.dataset.pageValue) { state.table.page = Number(el.dataset.pageValue); render(); }
    if (el.dataset.baseTab) { state.base.tab = el.dataset.baseTab; state.table.page = 1; render(); }
    if (el.dataset.reconcileTab) { state.reconcile.tab = el.dataset.reconcileTab; state.table.page = 1; render(); }
    if (el.dataset.reconcileBill) { state.reconcile.selectedBill = el.dataset.reconcileBill; navigate("reconcile"); }
    if (el.dataset.logisticsTab) { state.logisticsRecon.tab = el.dataset.logisticsTab; state.table.page = 1; render(); }
    if (el.dataset.logisticsBill) { state.logisticsRecon.selectedBill = el.dataset.logisticsBill; navigate("logisticsReconcile"); }
    if (el.dataset.logisticsCostsBill) navigate("logistics", { logisticsBillId: el.dataset.logisticsCostsBill });
    if (el.dataset.openFactoryImport !== undefined) openFactoryImportModal(true);
    if (el.dataset.openLogisticsImport !== undefined) openLogisticsImportModal(true);
    if (el.dataset.openSettlementCreate !== undefined) openSettlementCreateModal(el.dataset.openSettlementCreate);
    if (el.dataset.createSettlement) createSettlement(el.dataset.createSettlement);
    if (el.dataset.openSettlementEdit) openSettlementEditModal(el.dataset.openSettlementEdit);
    if (el.dataset.updateSettlement) updateSettlementAdjustments(el.dataset.updateSettlement);
    if (el.dataset.openSettlementPayment) openSettlementPaymentModal(el.dataset.openSettlementPayment);
    if (el.dataset.markSettlementPaid) markSettlementPaid(el.dataset.markSettlementPaid);
    if (el.dataset.openLogisticsSettlementCreate !== undefined) openLogisticsSettlementCreateModal(el.dataset.openLogisticsSettlementCreate);
    if (el.dataset.createLogisticsSettlement) createLogisticsSettlement(el.dataset.createLogisticsSettlement);
    if (el.dataset.viewLogisticsSettlement) navigate("logisticsSettlement", { logisticsBillId: el.dataset.viewLogisticsSettlement });
    if (el.dataset.openLogisticsSettlementEdit) openLogisticsSettlementEditModal(el.dataset.openLogisticsSettlementEdit);
    if (el.dataset.updateLogisticsSettlement) updateLogisticsSettlementAdjustments(el.dataset.updateLogisticsSettlement);
    if (el.dataset.openLogisticsSettlementPayment) openLogisticsSettlementPaymentModal(el.dataset.openLogisticsSettlementPayment);
    if (el.dataset.markLogisticsSettlementPaid) markLogisticsSettlementPaid(el.dataset.markLogisticsSettlementPaid);
    if (el.dataset.importNext !== undefined) {
      var activeImportKind = modal.dataset.view === "factoryImport" ? "factory" : "logistics";
      if (state.importStep === 1 && (!state.importFiles[activeImportKind] || !state.importDrafts[activeImportKind].billNo.trim())) {
        toast(state.importFiles[activeImportKind] ? "请先填写账单号" : "请先选择 Excel 或 CSV 账单文件");
        return;
      }
      state.importStep = Math.min(4, state.importStep + 1);
      if (modal.dataset.view === "factoryImport") openFactoryImportModal(false);
      else if (modal.dataset.view === "logisticsImport") openLogisticsImportModal(false);
      else render();
    }
    if (el.dataset.importPrev !== undefined) {
      state.importStep = Math.max(1, state.importStep - 1);
      if (modal.dataset.view === "factoryImport") openFactoryImportModal(false);
      else if (modal.dataset.view === "logisticsImport") openLogisticsImportModal(false);
    }
    if (el.dataset.applyImportTemplate) applyImportTemplate(el.dataset.applyImportTemplate);
    if (el.dataset.saveImportTemplate) saveImportTemplate(el.dataset.saveImportTemplate);
    if (el.dataset.startImport) startImportProgress(el.dataset.startImport);
    if (el.dataset.completeImport) {
      var importTarget = el.dataset.completeImport;
      var importLabel = importTarget === "reconcile" ? "工厂账单" : "物流账单";
      navigate(importTarget);
      toast(importLabel + "已导入，已生成对账任务");
    }
    if (el.dataset.templateSave !== undefined) toast(modal.dataset.view === "logisticsImport" ? "已模拟保存物流商账单模板" : "已模拟保存工厂账单模板");
    if (el.dataset.openIncome) openIncome(el.dataset.openIncome);
    if (el.dataset.openBaseRow) openBaseRow(el.dataset.openBaseRow);
    if (el.dataset.openConsumption) openConsumption(el.dataset.openConsumption);
    if (el.dataset.openCustomerStatement) openCustomerStatement(el.dataset.openCustomerStatement);
    if (el.dataset.openExpense) openExpense(el.dataset.openExpense);
    if (el.dataset.openBill) openBill(el.dataset.openBill);
    if (el.dataset.openSettlement) openSettlement(el.dataset.openSettlement);
    if (el.dataset.openLogisticsSettlement) openLogisticsSettlement(el.dataset.openLogisticsSettlement);
    if (el.dataset.openProfit) openProfit(el.dataset.openProfit);
    if (el.dataset.openException) openException(el.dataset.openException);
    if (el.dataset.openLogisticsBill) openLogisticsBill(el.dataset.openLogisticsBill);
    if (el.dataset.openLogisticsRecon) openLogisticsRecon(Number(el.dataset.openLogisticsRecon));
    if (el.dataset.openLogisticsCost) openLogisticsCost(el.dataset.openLogisticsCost);
    if (el.dataset.openReconcileLine) openReconcileLine(Number(el.dataset.openReconcileLine));
    if (el.dataset.handleDiff) openDiffModal(Number(el.dataset.handleDiff));
    if (el.dataset.handleMissing) openMissingModal(Number(el.dataset.handleMissing));
    if (el.dataset.handleCandidate) openCandidateModal(Number(el.dataset.handleCandidate));
    if (el.dataset.confirmAction) {
      var confirmationFromDrawer = Boolean(el.closest("[data-drawer]"));
      var confirmationFromModal = Boolean(el.closest("[data-modal]"));
      var noteSource = confirmationFromModal ? modalBody.querySelector("textarea") : confirmationFromDrawer ? drawerBody.querySelector("textarea") : null;
      openConfirmModal(el.dataset.confirmAction, {
        targetType: el.dataset.auditTargetType || (confirmationFromDrawer ? drawerKicker.textContent : modalKicker.textContent),
        targetId: el.dataset.auditTargetId || (confirmationFromDrawer ? drawerTitle.textContent : modalTitle.textContent),
        selectedPo: el.dataset.auditSelectedPo || "",
        note: noteSource ? noteSource.value.trim() : ""
      });
    }
    if (el.dataset.openOperationLog) openOperationLog(el.dataset.openOperationLog);
    if (el.dataset.exportTemplate) toast("已切换导出模板：" + el.dataset.exportTemplate);
    if (el.dataset.fieldMove) toast("已模拟调整字段顺序：" + el.dataset.fieldMove);
    if (el.dataset.exportBasePage !== undefined) {
      var currentBaseRows = applyPageFilters(filterBySearch(baseRows(state.base.tab)));
      recordExportOperation({ action: "导出基础数据", targetType: "基础数据集", targetId: state.base.tab, scope: "当前页", rowCount: Math.min(10, currentBaseRows.length), fieldCount: pageEl.querySelectorAll(".field-picker input:checked").length });
      toast("已创建当前页导出任务并写入操作日志");
    }
    if (el.dataset.exportBase !== undefined) {
      var filteredBaseRows = applyPageFilters(filterBySearch(baseRows(state.base.tab)));
      recordExportOperation({ action: "导出基础数据", targetType: "基础数据集", targetId: state.base.tab, scope: "当前筛选结果", rowCount: filteredBaseRows.length, fieldCount: pageEl.querySelectorAll(".field-picker input:checked").length });
      toast("已创建当前筛选结果导出任务并写入操作日志");
    }
    if (el.dataset.exportBaseAll !== undefined) {
      recordExportOperation({ action: "导出基础数据", targetType: "基础数据集", targetId: state.base.tab, scope: "全部匹配结果", rowCount: baseRows(state.base.tab).length, fieldCount: pageEl.querySelectorAll(".field-picker input:checked").length });
      toast("已创建全部匹配结果导出任务并写入操作日志");
    }
    if (el.dataset.saveExportTemplate !== undefined) {
      var exportFieldCount = pageEl.querySelectorAll(".field-picker input:checked").length;
      var selectedExportFormat = pageEl.querySelector("[data-export-format]");
      recordOperationLog({
        category: "配置变更",
        action: "保存基础数据导出模板",
        targetType: "导出模板",
        targetId: state.base.tab + " 自定义模板",
        values: [operationValue("适用数据集", "—", state.base.tab), operationValue("模板格式", "—", selectedExportFormat ? selectedExportFormat.value : "XLSX"), operationValue("导出字段数", "—", exportFieldCount)]
      });
      toast("已保存基础数据导出模板并写入操作日志");
    }
    if (el.dataset.generateCustomerStatement) generateCustomerStatement(el.dataset.generateCustomerStatement);
    if (el.dataset.exportCustomerStatement !== undefined) {
      var statementKeyValue = el.dataset.exportCustomerStatement;
      var statementRows = buildCustomerStatementRows();
      var statement = statementRows.find(function (row) { return row.key === statementKeyValue; });
      recordExportOperation({
        action: "导出客户资金对账单",
        targetType: "客户资金对账单",
        targetId: statement ? statement.customer + " / " + statement.period : "当前查询",
        scope: statement ? "单个客户对账单" : "当前查询结果",
        format: "XLSX",
        rowCount: statement ? statement.flows.length : statementRows.length,
        fieldCount: "系统标准字段",
        fieldNames: "客户、查询期间、币种、起点/结束余额、期间资金明细、关联订单"
      });
      toast("已创建客户资金对账单导出任务并写入操作日志");
    }
    if (el.dataset.finalConfirm) {
      recordSensitiveConfirmation(el.dataset.finalConfirm);
      closeModal();
      toast("已完成操作并写入操作日志：" + el.dataset.finalConfirm);
    }
    if (el.dataset.closeModal !== undefined) closeModal();
  }
  function handleInput(event) {
    if (event.target.dataset.importField !== undefined) {
      var draftKind = event.target.dataset.importKind;
      state.importDrafts[draftKind][event.target.dataset.importField] = event.target.value;
      showImportReviewError("");
      if (event.target.dataset.importField === "billNo" && state.importStep === 1) {
        var importNext = modalBody.querySelector("[data-import-next]");
        if (importNext) {
          importNext.disabled = !(state.importFiles[draftKind] && event.target.value.trim());
          importNext.title = importNext.disabled ? "请填写账单号并选择账单文件" : "";
        }
      }
    }
    if (event.target.dataset.search !== undefined) {
      state.table.q = event.target.value;
      state.table.page = 1;
      clearTimeout(handleInput._timer);
      handleInput._timer = setTimeout(render, 180);
    }
    if (event.target.dataset.settlementIncrease !== undefined || event.target.dataset.settlementDecrease !== undefined) {
      updateSettlementPayablePreview();
      showSettlementFormError("");
    }
  }
  function handleChange(event) {
    if (event.target.dataset.importFile !== undefined) {
      var importKind = event.target.dataset.importFile;
      state.importFiles[importKind] = event.target.files && event.target.files[0] ? event.target.files[0] : null;
      if (modal.dataset.view === "factoryImport") openFactoryImportModal(false);
      else if (modal.dataset.view === "logisticsImport") openLogisticsImportModal(false);
    }
    if (event.target.dataset.importField !== undefined) {
      var fieldKind = event.target.dataset.importKind;
      var fieldName = event.target.dataset.importField;
      state.importDrafts[fieldKind][fieldName] = event.target.value;
      if (fieldName === "party") {
        state.importDrafts[fieldKind].templateName = event.target.value + " 账单模板";
        var partyTemplates = importTemplatesForParty(fieldKind);
        state.importTemplateSelection[fieldKind] = partyTemplates.length ? partyTemplates[0].id : "";
      }
      if (fieldName === "originalCurrency" && event.target.value === "CNY") state.importDrafts[fieldKind].exchangeRate = "1.0000";
      if (fieldName === "party" || fieldName === "originalCurrency") refreshImportModal(fieldKind);
    }
    if (event.target.dataset.importMap !== undefined) {
      var mappingKind = event.target.dataset.importKind;
      state.importMappings[mappingKind][event.target.dataset.importMap] = event.target.value;
      refreshImportModal(mappingKind);
    }
    if (event.target.dataset.importTemplate !== undefined) {
      state.importTemplateSelection[event.target.dataset.importTemplate] = event.target.value;
    }
    if (event.target.dataset.chartSeries !== undefined) {
      toggleChartSeries(event.target);
    }
    if (event.target.dataset.selectedBill !== undefined) {
      state.reconcile.selectedBill = event.target.value;
      render();
    }
    if (event.target.dataset.logisticsSelectedBill !== undefined) {
      state.logisticsRecon.selectedBill = event.target.value;
      render();
    }
    if (event.target.dataset.settlementBill !== undefined) {
      openSettlementCreateModal(event.target.value);
    }
    if (event.target.dataset.logisticsSettlementBill !== undefined) {
      openLogisticsSettlementCreateModal(event.target.value);
    }
    if (event.target.dataset.pageFilter !== undefined) {
      state.pageFilters[event.target.dataset.pageFilter] = event.target.value;
      state.table.page = 1;
      render();
    }
    if (event.target.dataset.baseIncludeVoid !== undefined) {
      state.base.includeVoid = event.target.checked;
      state.table.page = 1;
      render();
    }
  }

  function toggleChartSeries(input) {
    var chartId = input.dataset.chartId;
    var seriesId = input.dataset.chartSeries;
    if (!state.chartSeries[chartId]) state.chartSeries[chartId] = {};
    state.chartSeries[chartId][seriesId] = input.checked;
    var chart = document.querySelector('[data-chart="' + chartId + '"]');
    if (!chart) return;
    var plottedSeries = chart.querySelector('[data-series="' + seriesId + '"]');
    if (plottedSeries) plottedSeries.classList.toggle("is-hidden", !input.checked);
    var legendItem = input.closest(".chart-legend-item");
    if (legendItem) legendItem.classList.toggle("is-muted", !input.checked);
    var selected = Array.prototype.slice.call(chart.querySelectorAll("[data-chart-series]:checked"));
    var emptyState = chart.querySelector("[data-chart-empty]");
    if (emptyState) emptyState.hidden = selected.length > 0;
    var names = selected.map(function (item) { return item.closest(".chart-legend-item").querySelector(".chart-legend-text").textContent; });
    var svg = chart.querySelector(".chart");
    if (svg) svg.setAttribute("aria-label", svg.dataset.chartLabel + "。当前显示：" + (names.length ? names.join("、") : "未显示任何指标"));
  }

  function openDrawer(kicker, title, html) {
    drawerKicker.textContent = kicker;
    drawerTitle.textContent = title;
    drawerBody.innerHTML = html;
    enhanceHelp(drawerBody);
    enhanceSelects(drawerBody);
    backdrop.hidden = false;
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
  }
  function closeDrawer() {
    hideHelpTooltip();
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    backdrop.hidden = true;
  }
  function openModal(kicker, title, html) {
    modalKicker.textContent = kicker;
    modalTitle.textContent = title;
    modalBody.innerHTML = html;
    enhanceHelp(modalBody);
    enhanceSelects(modalBody);
    modalBackdrop.hidden = false;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
  }
  function closeModal() {
    hideHelpTooltip();
    state.pendingSensitiveOperation = null;
    if (state.importProgressTimer) {
      cancelPendingImportAudit();
      clearInterval(state.importProgressTimer);
      state.importProgressTimer = null;
    }
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    modalBackdrop.hidden = true;
    delete modal.dataset.view;
  }
  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add("show");
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(function () { toastEl.classList.remove("show"); }, 1800);
  }

  function summary(items) {
    return '<dl class="summary">' + items.map(function (item) { return '<div><dt>' + esc(item[0]) + '</dt><dd>' + item[1] + '</dd></div>'; }).join("") + '</dl>';
  }
  function auditLog(action) {
    return '<div class="audit-log">' +
      '<div class="audit-item"><time>2026-08-13 21:05</time><strong>系统生成</strong><span>原值：— / 新值：待处理</span></div>' +
      '<div class="audit-item"><time>2026-08-13 21:18</time><strong>' + esc(action || "财务查看") + '</strong><span>操作人：王敏；备注：原型模拟日志</span></div>' +
      '</div>';
  }

  function openBaseRow(key) {
    var parts = String(key || "").split("::");
    var tab = parts[0] || state.base.tab;
    var rowKey = parts.slice(1).join("::");
    var rows = baseRows(tab);
    var row = rows.find(function (r, i) { return String(r.orderNo || r.id || r.purchaseNo || i) === rowKey; }) || rows[0];
    if (!row) return;
    var order = data.orders.find(function (o) { return o.id === row.orderNo || o.id === row.id || o.purchaseNo === row.purchaseNo; }) || data.orders[0];
    var orderIndex = Math.max(0, data.orders.indexOf(order));
    var meta = baseMeta(order, orderIndex);
    var logistics = data.logisticsCosts.find(function (l) { return l.orderId === order.id; }) || {};
    var val = function (name, fallback) { return row[name] == null ? fallback : row[name]; };
    var currency = row.currency || order.currency || data.baseCurrency;
    var customerPayable = val("customerPayable", meta.customerPayable);
    var actualDebit = val("actualDebit", meta.actualDebit);
    var refundAmount = val("refundAmount", val("actualRefund", meta.refundAmount));
    var customerNet = val("customerNet", meta.customerNet);
    var factoryPriceSnapshot = val("factoryPriceSnapshot", round(order.factoryCost / Math.max(meta.qty, 1)));
    var purchaseAmount = val("purchaseAmount", order.factoryCost);
    var factoryCost = val("factoryCost", val("factoryCostAmount", meta.factoryCost));
    var estimatedLogistics = val("estimatedLogistics", order.estimatedLogisticsCostCny || order.logisticsCost);
    var actualLogistics = val("actualLogistics", logistics.actualCost ? logistics.actualCostCny : order.logisticsCost);
    var logisticsDiff = val("logisticsDiff", round(actualLogistics - estimatedLogistics));
    var currentGross = val("currentGross", meta.currentGross);
    openDrawer("基础数据金额链路", row.orderNo || row.id || row.purchaseNo,
      summary([["客户", esc(row.customer || order.customer)], ["数据集", esc(tab)], ["客户净消耗", money(customerNet, currency)], ["当前毛利", money(currentGross, currency)]]) +
      '<section class="drawer-section"><h3>链路总览</h3><div class="chain-flow">' + ["客户", "订单", "订单详情", "SKU价格快照", "代理商价格快照", "客户费用", "客户扣款", "退款", "采购单", "工厂价格快照", "工厂成本", "物流预估/实际成本", "当前利润"].map(function (name) {
        return '<span>' + esc(name) + '</span>';
      }).join("") + '</div></section>' +
      '<section class="drawer-section"><h3>A. 客户与订单</h3>' + simpleTable(["客户", "客户类型", "订单号", "平台订单号", "订单类型", "订单状态", "支付时间"], [[esc(row.customer || order.customer), esc(row.customerType || meta.customerType), esc(row.orderNo || order.id), esc(row.platformOrderNo || order.id.replace("ORDER", "AMZ")), tag(row.type || order.type), tag(row.status || meta.orderStatus), esc(row.paidAt || order.paidAt)]]) + '</section>' +
      '<section class="drawer-section"><h3>B. 订单详情与价格快照</h3>' + simpleTable(["订单详情 ID", "SKU", "数量", "平台 SKU 对客价", "代理商价", "代理商对客价", "实际成交单价", "产品销售金额"], [[esc(row.detailId || order.detailId), esc(row.sku || order.sku), val("qty", meta.qty), money(val("standardPrice", meta.standardPrice), currency), money(val("agentPrice", meta.agentPrice), currency), money(val("agentSalePrice", meta.agentSalePrice), currency), money(val("dealPrice", meta.dealPrice), currency), money(val("productAmount", order.productIncome), currency)]]) + '</section>' +
      '<section class="drawer-section"><h3>C. 客户费用与资金</h3>' + simpleTable(["产品总售价", "应收运费", "应收设计费", "预上网费", "其他服务费", "客户应付金额", "实际扣款", "已退款", "净消耗"], [[money(val("productTotal", order.productIncome), currency), money(val("receivableShipping", order.logisticsIncome), currency), money(val("receivableDesign", order.designFee), currency), money(val("preOnlineFee", meta.preOnlineFee), currency), money(val("otherService", order.serviceFee), currency), money(customerPayable, currency), money(actualDebit, currency), money(refundAmount, currency), money(customerNet, currency)]]) + '</section>' +
      '<section class="drawer-section"><h3>D. 采购单与工厂成本</h3>' + simpleTable(["采购单号", "工厂", "工厂单价快照", "当前工厂价", "采购金额", "工厂成本", "对账状态", "结算状态", "是否作废"], [[esc(row.purchaseNo || order.purchaseNo), esc(row.supplier || order.supplier), money(factoryPriceSnapshot, currency), money(val("currentFactoryPrice", factoryPriceSnapshot), currency), money(purchaseAmount, currency), money(factoryCost, currency), tag(row.reconcileStatus || order.reconciled), tag(row.settlementStatus || order.settlement), tag(row.voided || "否")]]) + '</section>' +
      '<section class="drawer-section"><h3>E. 物流、代理商与利润</h3>' + simpleTable(["预估物流成本", "实际物流成本", "物流成本差额", "代理商利润", "代理商应付利润", "内部绩效利润", "利润状态", "当前毛利"], [[money(estimatedLogistics, currency), money(actualLogistics, currency), money(logisticsDiff, currency), money(val("agentProfitTotal", meta.agentProfitTotal), currency), money(val("agentPayableProfit", meta.agentPayableProfit), currency), money(val("internalPerformanceProfit", meta.internalPerformanceProfit), currency), tag(row.profitStatus || meta.profitStatus), money(currentGross, currency)]]) + '</section>' +
      '<section class="drawer-section"><h3>操作日志</h3>' + auditLog("查看基础数据金额链路") + '</section>');
  }

  function openIncome(id) {
    var r = data.incomes.find(function (x) { return x.id === id; });
    var order = data.orders.find(function (o) { return o.id === r.orderId; });
    openDrawer("收入事件详情", id,
      summary([["客户", esc(r.customer)], ["订单号", esc(r.orderId)], ["收入类型", esc(r.type)], ["净金额", money(r.netAmount, r.currency)]]) +
      '<section class="drawer-section"><h3>订单金额拆分</h3>' + simpleTable(["产品收入", "物流收入", "设计费", "服务费", "退款", "净收入"], [[money(order.productIncome, order.currency), money(order.logisticsIncome, order.currency), money(order.designFee, order.currency), money(order.serviceFee, order.currency), money(order.refund, order.currency), money(order.netIncome, order.currency)]]) + '</section>' +
      '<section class="drawer-section"><h3>事件来源与状态</h3>' + simpleTable(["来源单据", "状态", "操作人", "创建时间"], [[esc(r.sourceDoc), tag(r.status), esc(r.operator), esc(r.occurred)]]) + '</section>' +
      '<section class="drawer-section"><h3>操作日志</h3>' + auditLog("生成收入事件") + '</section>');
  }
  function openConsumption(flowNo) {
    var r = data.customerFlows.find(function (x) { return x.flowNo === flowNo; });
    if (!r) return;
    var order = data.orders.find(function (o) { return o.id === r.orderId; });
    var incomeTotal = r.incomeEventStatus === "缺失" ? 0 : r.incomeEventStatus === "金额差异" ? r.orderPayable - 5 : r.orderPayable;
    openDrawer("客户消耗流水详情", flowNo,
      summary([["客户", esc(r.customer)], ["流水类型", tag(r.flowType)], ["变动金额", money(r.amount, r.currency)], ["一致性状态", tag(r.consistencyStatus)]]) +
      '<section class="drawer-section"><h3>A. 资金信息</h3>' + simpleTable(["资金流水号", "发生时间", "变动前余额", "变动金额", "变动后余额", "币种", "资金状态"], [[esc(r.flowNo), esc(r.occurred), money(r.beforeBalance, r.currency), money(r.amount, r.currency), money(r.afterBalance, r.currency), esc(r.currency), tag(r.fundStatus)]]) + '</section>' +
      '<section class="drawer-section"><h3>B. 订单信息</h3>' + simpleTable(["订单号", "平台订单号", "客户", "订单类型", "下单时间", "支付时间", "订单应付金额", "订单支付状态"], [[esc(r.orderId), esc(r.platformOrderNo), esc(r.customer), esc(order ? order.type : "—"), esc(order ? order.created : "—"), esc(order ? order.paidAt : "—"), money(r.orderPayable, r.currency), tag(r.orderPayStatus)]]) + '</section>' +
      '<section class="drawer-section"><h3>C. 消耗拆分</h3>' + simpleTable(["产品费", "物流费", "设计费", "服务费", "其他费", "合计"], [[money(r.productFee, r.currency), money(r.logisticsFee, r.currency), money(r.designFee, r.currency), money(r.serviceFee, r.currency), money(r.otherFee, r.currency), money(r.productFee + r.logisticsFee + r.designFee + r.serviceFee + r.otherFee, r.currency)]]) + '</section>' +
      '<section class="drawer-section"><h3>D. 财务收入事件</h3>' + simpleTable(["收入类型", "收入事件合计", "收入事件状态"], [["CUSTOMER_PRODUCT_INCOME / SHIPPING / DESIGN / SERVICE", money(incomeTotal, r.currency), tag(r.incomeEventStatus)]]) + '</section>' +
      '<section class="drawer-section"><h3>E. 一致性检查</h3>' + simpleTable(["订单应付金额", "订单有效扣款合计", "收入事件合计", "一致性状态"], [[money(r.orderPayable, r.currency), money(r.consumptionAmount, r.currency), money(incomeTotal, r.currency), tag(r.consistencyStatus)]]) + '</section>' +
      '<section class="drawer-section"><h3>F. 退款/冲销</h3>' + simpleTable(["关联原流水号", "退款金额", "退款时间", "退款原因", "退款后余额"], [[esc(r.originFlowNo), r.flowType === "ORDER_REFUND" ? money(r.amount, r.currency) : money(0, r.currency), r.flowType === "ORDER_REFUND" ? esc(r.occurred) : "—", r.flowType === "ORDER_REFUND" ? esc(r.remark) : "—", money(r.afterBalance, r.currency)]]) + '</section>' +
      '<section class="drawer-section"><h3>操作日志</h3>' + auditLog("查看客户资金流水") + '</section>');
  }
  function generateCustomerStatement(key) {
    var range = consumptionQueryRange();
    var account = scopedCustomerAccounts().find(function (item) {
      return statementKey(item.customer, item.currency, range) === key;
    });
    if (!account) {
      toast("当前筛选范围已变化，请刷新后重试");
      return;
    }
    var liveRow = buildCustomerStatementRow(account, range);
    state.statementSequence += 1;
    var snapshot = Object.assign({}, liveRow, {
      statementNo: "CSTAT-" + currentDateTime().slice(0, 10).replace(/-/g, "") + "-" + String(state.statementSequence).padStart(4, "0"),
      dataStatus: "已生成快照",
      generatedAt: currentDateTime(),
      flows: liveRow.flows.slice()
    });
    if (!state.statementSnapshots[key]) state.statementSnapshots[key] = [];
    state.statementSnapshots[key].push(snapshot);
    recordStatementSnapshotOperation(snapshot);
    var keepDrawerOpen = drawer.classList.contains("is-open");
    render();
    if (keepDrawerOpen) openCustomerStatement(key);
    toast("已生成客户资金对账快照：" + snapshot.statementNo);
  }

  function openCustomerStatement(key) {
    var b = buildCustomerStatementRows().find(function (row) { return row.key === key; });
    if (!b) return;
    var rows = b.flows;
    var effectiveRows = rows.filter(isEffectiveCustomerFlow);
    var abnormalAmount = sum(effectiveRows.filter(function (flow) { return flow.consistencyStatus !== "一致"; }), function (flow) { return flow.amount; });
    var opening = b.balanceAvailable ? money(b.openingBalance, b.currency) : "—";
    var closing = b.balanceAvailable ? money(b.closingBalance, b.currency) : "—";
    var netMovement = b.balanceAvailable ? money(b.closingBalance - b.openingBalance, b.currency) : "—";
    openDrawer("客户资金对账单详情", b.statementNo === "—" ? "实时查询" : b.statementNo,
      summary([["客户", esc(b.customer)], ["数据状态", tag(b.dataStatus, b.dataStatus === "已生成快照" ? "success" : "blue")], ["查询期间", esc(b.period)], ["查询结束余额", closing]]) +
      '<section class="drawer-section"><h3>对账汇总</h3>' + simpleTable(["客户", "查询期间", "币种", "查询起点余额", "查询结束余额", "期间净变动", "订单消耗总额", "退款总额", "异常金额"], [[esc(b.customer), esc(b.period), esc(b.currency), opening, closing, netMovement, money(b.consumptionAmount, b.currency), money(b.refundAmount, b.currency), money(abnormalAmount, b.currency)]]) + '</section>' +
      '<section class="drawer-section"><h3>范围内资金明细</h3>' + customerStatementDetailTable(rows) + '</section>' +
      '<section class="drawer-section"><h3>订单关联规则</h3><p class="chip">对账明细 → CustomerBalanceFlow → order_id → Order → OrderDetail → Order Fee → FinancialEvent</p></section>' +
      '<div class="drawer-actions"><button class="button button-secondary" data-generate-customer-statement="' + esc(key) + '">' + (b.dataStatus === "已生成快照" ? "生成新快照" : "生成快照") + '</button><button class="button button-secondary" data-export-customer-statement="' + esc(key) + '">导出对账单</button></div>');
  }
  function customerStatementDetailTable(rows) {
    return '<div class="table-wrap table-tall"><table><thead><tr><th>对账明细序号</th><th>发生时间</th><th>资金流水号</th><th>流水类型</th><th>订单号</th><th>平台订单号</th><th>订单详情摘要</th><th>费用构成</th><th class="num">本次消耗/返还金额</th><th>余额变动方向</th><th class="num">变动后余额</th><th>订单支付状态</th><th class="num">收入事件合计</th><th>订单关联状态</th><th>一致性状态</th><th>备注</th><th class="sticky-action">操作</th></tr></thead><tbody>' +
      rows.map(function (r, i) {
        var incomeTotal = r.incomeEventStatus === "缺失" ? 0 : r.incomeEventStatus === "金额差异" ? r.orderPayable - 5 : r.orderPayable;
        var linked = r.flowType !== "ORDER_CONSUMPTION" ? "非订单流水" : r.orderId === "—" ? "缺失" : "已关联";
        return '<tr><td>' + (i + 1) + '</td><td>' + esc(r.occurred) + '</td><td>' + esc(r.flowNo) + '</td><td>' + esc(r.flowType) + '</td><td>' + esc(r.orderId) + '</td><td>' + esc(r.platformOrderNo) + '</td><td>' + esc(r.orderId === "—" ? "—" : "SKU/数量摘要") + '</td><td>' + esc("产品 " + r.productFee + " / 物流 " + r.logisticsFee + " / 设计 " + r.designFee + " / 服务 " + r.serviceFee) + '</td><td class="num">' + money(r.amount, r.currency) + '</td><td>' + esc(r.direction) + '</td><td class="num">' + money(r.afterBalance, r.currency) + '</td><td>' + tag(r.orderPayStatus) + '</td><td class="num">' + money(incomeTotal, r.currency) + '</td><td>' + tag(linked, linked === "缺失" ? "danger" : linked === "已关联" ? "success" : "blue") + '</td><td>' + tag(r.consistencyStatus) + '</td><td>' + esc(r.remark) + '</td><td class="sticky-action"><button class="link-button" data-open-consumption="' + esc(r.flowNo) + '">查看流水</button></td></tr>';
      }).join("") + '</tbody></table></div>';
  }
  function openExpense(id) {
    var r = data.expenses.find(function (x) { return x.id === id; });
    var linkageNote = r.counterpartyType === "物流商" ? "物流成本按订单归集，不关联采购单" : "工厂成本通过采购单关联订单";
    var external = r.counterpartyType === "工厂" ? tag(r.external ? "是" : "否", r.external ? "warn" : "success") : "—";
    openDrawer("支出事件详情", r.eventNo,
      summary([["成本方类型", tag(r.counterpartyType, "blue")], ["成本方", esc(r.counterparty)], ["关联订单号", esc(r.orderId)], ["系统金额", money(r.amount, r.currency)]]) +
      '<section class="drawer-section"><h3>业务关联</h3>' + simpleTable(["业务关联单据", "关联订单号", "关联采购单号", "订单详情", "SKU"], [[esc(r.businessDocumentType + " " + r.businessDocumentNo), esc(r.orderId), esc(r.purchaseNo), esc(r.detailId), esc(r.sku)]]) + '<p class="chip">' + esc(linkageNote) + '</p></section>' +
      '<section class="drawer-section"><h3>来源与状态</h3>' + simpleTable(["支出类型", "来源", "对账状态", "结算状态", "外部补录"], [[esc(r.type), esc(r.source), tag(r.reconcileStatus), tag(r.settlementStatus), external]]) + '</section>' +
      '<section class="drawer-section"><h3>操作日志</h3>' + auditLog("成本事件生成") + '</section>');
  }
  function openBill(id) {
    var b = data.bills.find(function (x) { return x.id === id; });
    openDrawer("工厂账单详情", id,
      summary([["工厂", esc(b.supplier)], ["账期", esc(b.period)], ["账单总金额", money(b.totalAmount, b.currency)], ["系统应付", money(b.systemPayable, b.currency)]]) +
      '<section class="drawer-section"><h3>导入与对账概览</h3>' + simpleTable(["总条数", "自动匹配", "金额差异", "平台缺单", "未匹配", "重复", "已确认", "状态"], [[b.totalLines, b.autoMatched, b.amountDiff, b.platformMissing, b.unmatched, b.duplicated, b.confirmed, tag(b.status)]]) + '</section>' +
      '<section class="drawer-section"><h3>操作日志</h3>' + auditLog("导入工厂账单") + '</section><div class="drawer-actions"><button class="button button-primary" data-reconcile-bill="' + esc(b.id) + '">进入对账</button><button class="button button-danger" data-confirm-action="关闭账单">关闭账单</button></div>');
  }
  function openSettlement(id) {
    var s = data.settlements.find(function (x) { return x.id === id; });
    var locked = settlementAdjustmentsLocked(s);
    var actions = locked
      ? '<div class="settlement-lock-state"><strong>付款后不可修改</strong><span>该结算单已标记付款，增加金额、减少金额和备注已锁定。</span></div><div class="drawer-actions"><button class="button button-secondary" disabled>编辑调整</button><button class="button button-secondary" disabled>已付款</button></div>'
      : '<div class="drawer-actions"><button class="button button-secondary" data-open-settlement-edit="' + esc(s.id) + '">编辑调整</button><button class="button button-primary" data-open-settlement-payment="' + esc(s.id) + '">标记付款</button></div>';
    openDrawer("结算详情", id,
      summary([["系统应付", money(s.systemPayable, s.currency)], ["最终应付", money(s.payable, s.currency)], ["已付", money(s.paid, s.currency)], ["未付", money(s.unpaid, s.currency)]]) +
      '<section class="drawer-section"><h3>结算调整</h3>' + simpleTable(["增加金额", "减少金额", "备注", "最后修改人", "最后修改时间"], [[money(s.increaseAmount, s.currency), money(s.decreaseAmount, s.currency), esc(s.adjustmentNote || "—"), esc(s.updatedBy || s.creator), esc(s.updatedAt || s.createdAt)]]) + '</section>' +
      '<section class="drawer-section"><h3>账单信息</h3>' + simpleTable(["账单号", "账期", "对账状态", "结算状态", "创建人", "付款时间"], [[esc(s.billId), esc(s.period), tag(s.reconcileStatus), tag(s.settlementStatus), esc(s.creator), esc(s.paidAt)]]) + '</section>' +
      '<section class="drawer-section"><h3>关联采购单列表</h3>' + expenseTable(data.expenses.filter(function (e) { return e.supplier === s.supplier; }).slice(0, 5)) + '</section>' +
      '<section class="drawer-section"><h3>操作日志</h3>' + auditLog("结算调整与付款") + '</section>' + actions);
  }
  function openLogisticsSettlement(id) {
    var settlement = data.logisticsSettlements.find(function (item) { return item.id === id; });
    if (!settlement) return;
    var locked = settlementAdjustmentsLocked(settlement);
    var actions = locked
      ? '<div class="settlement-lock-state"><strong>付款后不可修改</strong><span>该物流结算单已标记付款，增加金额、减少金额和备注已锁定。</span></div><div class="drawer-actions"><button class="button button-secondary" disabled>编辑调整</button><button class="button button-secondary" disabled>已付款</button></div>'
      : '<div class="drawer-actions"><button class="button button-secondary" data-open-logistics-settlement-edit="' + esc(settlement.id) + '">编辑调整</button><button class="button button-primary" data-open-logistics-settlement-payment="' + esc(settlement.id) + '">标记付款</button></div>';
    var costRows = data.logisticsCosts.filter(function (cost) { return cost.billId === settlement.billId; }).slice(0, 5);
    openDrawer("物流结算详情", settlement.id,
      summary([["物流商", esc(settlement.carrier)], ["原币最终应付", money(settlement.payable, settlement.originalCurrency)], ["人民币折算金额", money(settlement.payableCny, settlement.baseCurrency)], ["结算状态", tag(settlement.settlementStatus)]]) +
      '<section class="drawer-section"><h3>结算调整</h3>' + simpleTable(["对账确认金额", "增加金额", "减少金额", "备注"], [[money(settlement.systemPayable, settlement.originalCurrency), money(settlement.increaseAmount, settlement.originalCurrency), money(settlement.decreaseAmount, settlement.originalCurrency), esc(settlement.adjustmentNote || "—")]]) + '</section>' +
      '<section class="drawer-section"><h3>账单与汇率快照</h3>' + simpleTable(["物流账单", "原始币种", "记账汇率", "汇率日期", "汇率来源"], [[esc(settlement.billId), esc(settlement.originalCurrency), settlement.exchangeRate.toFixed(4), esc(settlement.rateDate), esc(settlement.rateSource)]]) + '</section>' +
      '<section class="drawer-section"><h3>关联成本明细</h3>' + logisticsTable(costRows) + '</section>' +
      '<section class="drawer-section"><h3>操作日志</h3>' + auditLog("物流结算调整与付款") + '</section>' + actions);
  }
  function openProfit(id) {
    var o = data.orders.find(function (x) { return x.id === id; });
    var logistics = data.logisticsCosts.find(function (x) { return x.orderId === id; });
    var originalCurrency = logistics ? logistics.originalCurrency : data.baseCurrency;
    var originalCost = logistics ? (logistics.actualCost || logistics.estimatedCost) : o.logisticsCost;
    var exchangeRate = logistics ? logistics.exchangeRate : 1;
    openDrawer("订单利润详情", id,
      summary([["客户", esc(o.customer)], ["订单类型", tag(o.type)], ["含售后毛利", money(o.gross, o.currency)], ["利润状态", tag(o.profitStatus)]]) +
      '<section class="drawer-section"><h3>A. 收入</h3>' + simpleTable(["产品收入", "物流收入", "设计费", "服务费", "退款", "净收入"], [[money(o.productIncome, o.currency), money(o.logisticsIncome, o.currency), money(o.designFee, o.currency), money(o.serviceFee, o.currency), money(o.refund, o.currency), money(o.netIncome, o.currency)]]) + '</section>' +
      '<section class="drawer-section"><h3>B. 工厂成本</h3>' + simpleTable(["采购单", "工厂", "SKU", "数量", "系统金额", "发货时间", "对账状态", "结算状态", "外部补录"], [[esc(o.purchaseNo), esc(o.supplier), esc(o.sku), 1, money(o.factoryCost, o.currency), esc(o.shippedAt), tag(o.reconciled), tag(o.settlement), tag("否", "success")]]) + '</section>' +
      '<section class="drawer-section"><h3>C. 物流成本折算</h3>' + simpleTable(["面单", "渠道", "原币成本", "原始币种", "记账汇率", "人民币预估成本", "人民币实际成本", "利润采用成本", "利润状态"], [[esc(logistics ? logistics.labelNo : "LBL-" + o.id.slice(-5)), esc(logistics ? logistics.carrier : "—"), money(originalCost, originalCurrency), esc(originalCurrency), exchangeRate.toFixed(4), money(o.estimatedLogisticsCostCny, data.baseCurrency), logistics && logistics.actualCost ? money(o.actualLogisticsCostCny, data.baseCurrency) : "—", money(o.logisticsCost, data.baseCurrency), tag(o.profitStatus)]]) + '</section>' +
      '<section class="drawer-section"><h3>D/E. 售后与补发</h3>' + simpleTable(["是否售后", "是否补发", "售后成本", "说明"], [[o.hasAfterSale ? "是" : "否", o.hasReship ? "是" : "否", money(o.afterCost, o.currency), o.type === "补发单" ? "补发单独立计算利润并关联原订单" : "售后成本计入原订单真实毛利"]]) + '</section>' +
      '<section class="drawer-section"><h3>F. 人民币汇总</h3>' + simpleTable(["原始毛利", "含售后毛利", "毛利率", "核算币种"], [[money(o.originalGross, o.currency), money(o.gross, o.currency), o.grossRate.toFixed(1) + "%", esc(o.currency)]]) + '</section>');
  }
  function openException(id) {
    var e = data.exceptions.find(function (x) { return x.id === id; });
    var originalImpact = e.originalCurrency ? '<section class="drawer-section"><h3>物流原币影响</h3>' + simpleTable(["原币差额", "原始币种", "记账汇率", "人民币影响金额"], [[money(e.originalAmount, e.originalCurrency), esc(e.originalCurrency), e.exchangeRate.toFixed(4), money(e.amount, e.currency)]]) + '</section>' : "";
    openDrawer("财务异常详情", id,
      summary([["异常类型", esc(e.type)], ["工厂", esc(e.supplier)], ["金额", money(e.amount, e.currency)], ["状态", tag(e.status)]]) +
      '<section class="drawer-section"><h3>关联单据</h3>' + simpleTable(["订单号", "采购单号", "账单号", "发生时间", "负责人"], [[esc(e.orderId), esc(e.purchaseNo), esc(e.billId), esc(e.occurred), esc(e.owner)]]) + '</section>' +
      originalImpact +
      '<section class="drawer-section"><h3>操作日志</h3>' + auditLog("异常处理") + '</section><div class="drawer-actions"><button class="button button-primary" data-confirm-action="确认异常处理结果">确认处理</button></div>');
  }
  function openLogisticsBill(id) {
    var b = data.logisticsBills.find(function (x) { return x.id === id; });
    openDrawer("物流账单详情", id,
      summary([["物流商", esc(b.carrier)], ["原始币种", esc(b.originalCurrency)], ["账单原币总金额", money(b.totalAmount, b.originalCurrency)], ["账单人民币折算金额", money(b.totalAmountCny, b.baseCurrency)]]) +
      '<section class="drawer-section"><h3>汇率快照</h3>' + simpleTable(["记账汇率", "汇率日期", "汇率来源", "本位币"], [[b.exchangeRate.toFixed(4), esc(b.rateDate), esc(b.rateSource), esc(b.baseCurrency)]]) + '</section>' +
      '<section class="drawer-section"><h3>匹配概览</h3>' + simpleTable(["总条数", "自动匹配", "未匹配", "重复", "原币预估总成本", "原币实际总成本", "原币总差额", "人民币实际成本", "状态"], [[b.totalLines, b.autoMatched, b.unmatched, b.duplicated, money(b.estimatedTotal, b.originalCurrency), money(b.actualTotal, b.originalCurrency), money(b.diff, b.originalCurrency), money(b.actualTotalCny, b.baseCurrency), tag(b.status)]]) + '</section>' +
      '<section class="drawer-section"><h3>操作日志</h3>' + auditLog("导入物流账单") + '</section><div class="drawer-actions"><button class="button button-primary" data-logistics-bill="' + esc(b.id) + '">进入物流成本对账</button><button class="button button-secondary" data-logistics-costs-bill="' + esc(b.id) + '">查看本账单成本</button><button class="button button-danger" data-confirm-action="关闭物流账单">关闭账单</button></div>');
  }
  function openLogisticsRecon(lineNo) {
    var l = data.logisticsReconcileLines.find(function (x) { return x.lineNo === lineNo; });
    openModal("物流成本偏差详情", "Line " + lineNo,
      '<div class="compare"><section class="panel"><header class="panel-head"><h3>系统侧（原币）</h3></header><div class="panel-body">' + simpleTable(["订单号", "面单号", "SKU", "数量", "工厂", "物流渠道", "报价表", "原币预估成本", "预估重量"], [[esc(l.orderId), esc(l.labelNo), esc(l.sku), l.qty, esc(l.supplier), esc(l.channel), "RATE-" + esc(l.originalCurrency), money(l.estimatedCost, l.originalCurrency), l.estimatedWeight + "kg"]]) + '</div></section><section class="panel"><header class="panel-head"><h3>物流账单侧（原币）</h3></header><div class="panel-body">' + simpleTable(["Tracking Number", "原币实际金额", "原始币种", "实际重量", "计费重量", "体积重", "账单日期", "原始账单数据"], [[esc(l.tracking), money(l.actualCost, l.originalCurrency), esc(l.originalCurrency), l.actualWeight + "kg", l.billWeight + "kg", (l.billWeight * 0.9).toFixed(2) + "kg", esc(l.billDate), esc(l.raw)]]) + '</div></section></div>' +
      '<section class="drawer-section"><h3>偏差与人民币入账</h3>' + simpleTable(["原币差额", "偏差率", "记账汇率", "人民币预估成本", "人民币实际成本", "人民币差额", "异常等级"], [[money(l.diff, l.originalCurrency), l.diffRate.toFixed(2) + "%", l.exchangeRate.toFixed(4), money(l.estimatedCostCny, l.baseCurrency), money(l.actualCostCny, l.baseCurrency), money(l.diffCny, l.baseCurrency), tag(l.level)]]) + '</section><div class="drawer-actions"><button class="button button-primary" data-confirm-action="标记物流成本异常">标记异常</button><button class="button button-secondary" data-confirm-action="暂缓物流成本异常">暂缓</button></div>');
  }
  function openLogisticsCost(labelNo) {
    var r = data.logisticsCosts.find(function (x) { return x.labelNo === labelNo; });
    openDrawer("物流成本详情", labelNo,
      summary([["订单号", esc(r.orderId)], ["Tracking", esc(r.tracking)], ["异常等级", tag(r.anomalyLevel)], ["偏差率", r.diffRate.toFixed(2) + "%"]]) +
      '<section class="drawer-section"><h3>原币成本对比</h3>' + simpleTable(["客户物流费用（CNY）", "原始币种", "原币预估成本", "原币实际成本", "原币差额", "实际账单状态"], [[money(r.customerFee, r.customerFeeCurrency), esc(r.originalCurrency), money(r.estimatedCost, r.originalCurrency), money(r.actualCost, r.originalCurrency), money(r.costDiff, r.originalCurrency), tag(r.actualBillStatus)]]) + '</section>' +
      '<section class="drawer-section"><h3>人民币入账</h3>' + simpleTable(["记账汇率", "汇率日期", "汇率来源", "人民币预估成本", "人民币实际成本", "人民币差额"], [[r.exchangeRate.toFixed(4), esc(r.rateDate), esc(r.rateSource), money(r.estimatedCostCny, r.baseCurrency), money(r.actualCostCny, r.baseCurrency), money(r.costDiffCny, r.baseCurrency)]]) + '</section>' +
      '<section class="drawer-section"><h3>重量与渠道</h3>' + simpleTable(["物流商", "报价表", "SKU", "工厂", "国家", "预估重量", "实际重量", "计费重量"], [[esc(r.carrier), esc(r.rateCard), esc(r.sku), esc(r.supplier), esc(r.country), r.estimatedWeight + "kg", r.actualWeight + "kg", r.billWeight + "kg"]]) + '</section>');
  }
  function openReconcileLine(lineNo) {
    var l = data.reconciliationLines.find(function (x) { return x.lineNo === lineNo; });
    openDrawer("对账明细", "Line " + lineNo, summary([["匹配状态", tag(l.matchStatus)], ["账单金额", money(l.billAmount, l.currency)], ["系统金额", money(l.systemAmount, l.currency)], ["差异", money(l.diff, l.currency)]]) + '<section class="drawer-section"><h3>匹配信息</h3>' + simpleTable(["工厂订单号", "平台订单号", "采购单", "SKU", "匹配方式", "匹配依据"], [[esc(l.supplierOrderNo), esc(l.platformOrderNo), esc(l.systemPurchaseNo), esc(l.systemSku), esc(l.method), esc(l.matchEvidence)]]) + '</section>');
  }

  function openDiffModal(lineNo) {
    var l = data.reconciliationLines.find(function (x) { return x.lineNo === lineNo; });
    openModal("金额差异处理", "Line " + lineNo,
      '<div class="compare"><section class="panel"><header class="panel-head"><h3>工厂账单</h3></header><div class="panel-body">' + simpleTable(["单号", "SKU", "数量", "总金额"], [[esc(l.supplierOrderNo), esc(l.billSku), l.qty, money(l.billAmount, l.currency)]]) + '</div></section><section class="panel"><header class="panel-head"><h3>系统采购单</h3></header><div class="panel-body">' + simpleTable(["采购单", "订单号", "订单详情", "SKU", "数量", "系统报价", "发货时间", "工厂"], [[esc(l.systemPurchaseNo), esc(l.systemOrderId), esc(l.systemDetailId), esc(l.systemSku), l.qty, money(l.systemAmount, l.currency), esc(l.shippedAt), esc(l.supplier)]]) + '</div></section></div>' +
      '<div class="drawer-section"><textarea placeholder="审核说明">第一版规则：以系统采购单金额为最终应付。</textarea><div class="drawer-actions"><button class="button button-primary" data-confirm-action="按系统金额确认">按系统金额确认</button><button class="button button-secondary" data-confirm-action="标记工厂账单错误">标记工厂账单错误</button><button class="button button-secondary" data-confirm-action="暂缓差异处理">暂缓</button></div></div>');
  }
  function openMissingModal(lineNo) {
    var l = data.reconciliationLines.find(function (x) { return x.lineNo === lineNo; });
    openModal("平台缺单处理", "Line " + lineNo + " / 外部补录采购单",
      '<div class="toolbar"><input value="' + esc(l.platformOrderNo) + '"><input value="' + esc(l.billSku) + '"><select><option>' + esc(l.supplier) + '</option></select><button class="button button-secondary">搜索</button></div>' +
      simpleTable(["订单号", "订单详情", "原有采购单", "已取消采购单", "当前工厂", "SKU", "数量"], [[esc(l.systemOrderId), esc(l.systemDetailId), "—", "PO-VOID-07123", esc(l.supplier), esc(l.billSku), l.qty]]) +
      '<div class="drawer-section"><textarea placeholder="创建原因">客服在工厂系统直接下单，平台没有对应采购单，需创建外部补录采购单。</textarea><div class="drawer-actions"><button class="button button-primary" data-confirm-action="创建外部补录采购单">确认创建外部补录采购单</button></div></div>');
  }
  function openCandidateModal(lineNo) {
    var l = data.reconciliationLines.find(function (x) { return x.lineNo === lineNo; });
    openModal("无法唯一匹配", "Line " + lineNo + " / 人工确认采购单",
      simpleTable(["采购单号", "状态", "工厂", "SKU", "数量", "发货时间", "是否已作废", "创建时间", "操作"], l.candidates.map(function (c) {
        return [esc(c.po), tag(c.status), esc(c.supplier), esc(c.sku), c.qty, esc(c.shippedAt), esc(c.voided), esc(c.created), '<button class="link-button" data-confirm-action="人工确认采购单" data-audit-selected-po="' + esc(c.po) + '">选择</button>'];
      })) + '<p class="chip">禁止自动选择：同一个订单 + SKU 存在作废采购单与当前采购单。</p>');
  }
  function openConfirmModal(action, context) {
    context = context || {};
    state.pendingSensitiveOperation = {
      action: action,
      targetType: context.targetType || "财务对象",
      targetId: context.targetId || "—",
      selectedPo: context.selectedPo || "",
      values: sensitiveOperationValues(action, context)
    };
    var initialNote = context.note || "确认按当前规则处理。";
    openModal("二次确认", action,
      '<p>该操作涉及财务审计：' + esc(action) + '。原型将记录操作人、操作时间、原值、新值与备注。</p><div class="drawer-section"><textarea placeholder="处理备注">' + esc(initialNote) + '</textarea><div class="drawer-actions"><button class="button button-primary" data-final-confirm="' + esc(action) + '">确认</button><button class="button button-secondary" data-close-modal>取消</button></div></div>' +
      '<section class="drawer-section"><h3>操作日志预览</h3>' + operationValuesTable(state.pendingSensitiveOperation.values) + '</section>');
  }

  init();
})();
