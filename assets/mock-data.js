(function () {
  "use strict";

  function pad(n, w) { return String(n).padStart(w || 2, "0"); }
  function dateText(i, h) {
    var d = new Date(2026, 7, 13, 21, 30, 0);
    d.setHours(d.getHours() - (h || 0));
    d.setMinutes(d.getMinutes() - i * 19);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  var customers = ["Customer A", "Customer B", "Customer C", "Customer D", "Customer E", "Customer F", "Customer G", "Customer H"];
  var suppliers = ["Factory A", "Factory B", "Factory C", "Factory D", "Factory E", "Factory F"];
  var baseCurrency = "CNY";
  var currencies = [baseCurrency];
  var logisticsCurrencies = ["USD", "EUR", "CNY", "GBP"];
  var exchangeRates = { USD: 7.18, EUR: 7.86, CNY: 1, GBP: 9.13 };
  var skus = ["SKU-8407", "SKU-8412", "SKU-8426", "SKU-8433", "SKU-8458", "SKU-8464", "SKU-8479", "SKU-8491"];
  var orderTypes = ["正常单", "售后单", "补发单"];
  var incomeTypes = ["产品收入", "物流收入", "设计费收入", "服务费收入", "客户退款", "手工调整"];
  var expenseTypes = ["工厂成本", "物流成本", "售后工厂成本", "售后物流成本", "工厂成本冲销", "物流成本冲销", "手工调整"];
  var asOfDate = "2026-08-14";
  var customerBalanceSnapshots = customers.map(function (customer, i) {
    return {
      customer: customer,
      currency: baseCurrency,
      snapshotAt: "2026-08-01 00:00",
      balance: round(1200 + i * 340)
    };
  });

  var orders = Array.from({ length: 96 }, function (_, i) {
    var type = i % 17 === 0 ? "售后单" : i % 19 === 0 ? "补发单" : "正常单";
    var currency = baseCurrency;
    var productIncome = type === "售后单" ? 0 : 42 + (i % 12) * 7.6;
    var logisticsIncome = type === "售后单" ? 0 : 6 + (i % 5) * 1.2;
    var designFee = i % 9 === 0 && type !== "售后单" ? 8 : 0;
    var serviceFee = i % 7 === 0 && type !== "售后单" ? 3.5 : 0;
    var refund = i % 13 === 0 ? 12 : 0;
    var factoryCost = 18 + (i % 10) * 4.2;
    var logisticsCost = 4.2 + (i % 7) * 0.9;
    var afterCost = type === "售后单" ? factoryCost + logisticsCost : 0;
    var netIncome = productIncome + logisticsIncome + designFee + serviceFee - refund;
    var gross = netIncome - factoryCost - logisticsCost - afterCost;
    return {
      id: "ORDER-20260813-" + pad(1200 + i, 5),
      detailId: "OD-" + pad(8000 + i, 5),
      customer: customers[i % customers.length],
      supplier: suppliers[i % suppliers.length],
      sku: skus[i % skus.length],
      type: type,
      currency: currency,
      purchaseNo: "PO-20260813-" + pad(3100 + i, 5),
      productIncome: round(productIncome),
      logisticsIncome: round(logisticsIncome),
      designFee: round(designFee),
      serviceFee: round(serviceFee),
      refund: round(refund),
      netIncome: round(netIncome),
      factoryCost: round(factoryCost),
      logisticsCost: round(logisticsCost),
      afterCost: round(afterCost),
      originalGross: round(netIncome - factoryCost - logisticsCost),
      gross: round(gross),
      grossRate: netIncome ? round(gross / netIncome * 100) : -100,
      reconciled: i % 6 === 0 ? "部分完成" : i % 11 === 0 ? "待对账" : "已完成",
      settlement: i % 8 === 0 ? "待结算" : i % 15 === 0 ? "部分付款" : "已结算",
      hasAfterSale: type === "售后单" || i % 13 === 0,
      hasReship: type === "补发单",
      created: dateText(i, i % 48),
      paidAt: dateText(i, i % 42),
      shippedAt: dateText(i, i % 32)
    };
  });

  var incomes = [];
  orders.forEach(function (order, i) {
    [
      ["产品收入", order.productIncome],
      ["物流收入", order.logisticsIncome],
      ["设计费收入", order.designFee],
      ["服务费收入", order.serviceFee],
      ["客户退款", -order.refund]
    ].forEach(function (row, j) {
      if (!row[1]) return;
      incomes.push({
        id: "INC-20260813-" + pad(incomes.length + 1, 5),
        occurred: dateText(i + j, j + i % 8),
        customer: order.customer,
        orderId: order.id,
        detailId: order.detailId,
        orderType: order.type,
        type: row[0],
        originalAmount: row[1] > 0 ? row[1] : 0,
        reversal: row[1] < 0 ? Math.abs(row[1]) : 0,
        netAmount: row[1],
        currency: order.currency,
        sourceDoc: row[0] === "客户退款" ? "REFUND-" + pad(2000 + i, 5) : "BAL-DEBIT-" + pad(6000 + i, 5),
        status: row[0] === "客户退款" ? "退款已生效" : "已确认",
        operator: ["王敏", "李哲", "陈露"][i % 3],
        note: order.type === "售后单" ? "售后单客户收入为 0" : "订单余额扣款后生成"
      });
    });
  });

  var customerFlows = [];
  customers.forEach(function (customer, ci) {
    var currency = currencies[ci % currencies.length];
    var balance = customerBalanceSnapshots[ci].balance;
    customerFlows.push({
      flowNo: "BAL-RECHARGE-" + pad(ci + 1, 5), occurred: dateText(ci, 84 + ci), customer: customer,
      flowType: "RECHARGE", direction: "收入", amount: round(520 + ci * 35), beforeBalance: balance,
      afterBalance: round(balance + 520 + ci * 35), orderId: "—", platformOrderNo: "—", orderPayable: 0,
      consumptionAmount: 0, originFlowNo: "—", currency: currency, fundStatus: "已完成",
      orderPayStatus: "—", incomeEventStatus: "—", consistencyStatus: "一致", source: "客户充值",
      operator: ["王敏", "李哲", "陈露"][ci % 3], remark: "充值入账", productFee: 0, logisticsFee: 0, designFee: 0, serviceFee: 0, otherFee: 0
    });
  });
  orders.slice(0, 48).forEach(function (order, i) {
    var payable = round(order.productIncome + order.logisticsIncome + order.designFee + order.serviceFee);
    var before = round(1700 + (i % 8) * 220 - i * 9);
    var amount = i === 5 ? round(payable - 6) : i === 9 ? round(payable * 2) : payable;
    var consistency = i === 5 ? "扣款不足" : i === 9 ? "重复扣款" : i === 13 ? "收入事件缺失" : i === 18 ? "收入金额不一致" : "一致";
    customerFlows.push({
      flowNo: "BAL-CONSUME-" + pad(i + 1, 5), occurred: order.paidAt, customer: order.customer,
      flowType: "ORDER_CONSUMPTION", direction: "支出", amount: amount, beforeBalance: before,
      afterBalance: round(before - amount), orderId: order.id, platformOrderNo: order.id.replace("ORDER", "AMZ"),
      orderPayable: payable, consumptionAmount: amount, originFlowNo: "—", currency: order.currency,
      fundStatus: "已完成", orderPayStatus: i === 5 ? "部分支付" : "已支付",
      incomeEventStatus: i === 13 ? "缺失" : i === 18 ? "金额差异" : "完整",
      consistencyStatus: consistency, source: "订单扣款", operator: "系统",
      remark: consistency === "一致" ? "订单余额扣款" : "命中资金一致性检查",
      productFee: order.productIncome, logisticsFee: order.logisticsIncome, designFee: order.designFee, serviceFee: order.serviceFee, otherFee: 0
    });
    if (order.refund) {
      customerFlows.push({
        flowNo: "BAL-REFUND-" + pad(i + 1, 5), occurred: dateText(i, i % 18), customer: order.customer,
        flowType: "ORDER_REFUND", direction: "收入", amount: order.refund, beforeBalance: round(before - amount),
        afterBalance: round(before - amount + order.refund), orderId: order.id, platformOrderNo: order.id.replace("ORDER", "AMZ"),
        orderPayable: payable, consumptionAmount: 0, originFlowNo: "BAL-CONSUME-" + pad(i + 1, 5), currency: order.currency,
        fundStatus: "已完成", orderPayStatus: "已退款", incomeEventStatus: "退款已生效", consistencyStatus: "一致",
        source: "售后退款", operator: ["王敏", "李哲", "陈露"][i % 3], remark: "退款返还余额",
        productFee: 0, logisticsFee: 0, designFee: 0, serviceFee: 0, otherFee: 0
      });
    }
  });
  customerFlows.push({
    flowNo: "BAL-CONSUME-ERROR-0001", occurred: dateText(3, 7), customer: "Customer C",
    flowType: "ORDER_CONSUMPTION", direction: "支出", amount: 88, beforeBalance: 930, afterBalance: 842,
    orderId: "—", platformOrderNo: "—", orderPayable: 0, consumptionAmount: 88, originFlowNo: "—",
    currency: baseCurrency, fundStatus: "已完成", orderPayStatus: "未知", incomeEventStatus: "缺失",
    consistencyStatus: "严重异常", source: "订单扣款", operator: "系统", remark: "ORDER_CONSUMPTION 缺少 order_id",
    productFee: 72, logisticsFee: 10, designFee: 0, serviceFee: 6, otherFee: 0
  });
  customerFlows.push({
    flowNo: "BAL-MANUAL-0001", occurred: dateText(4, 5), customer: "Customer A",
    flowType: "MANUAL_CREDIT", direction: "收入", amount: 25, beforeBalance: 640, afterBalance: 665,
    orderId: "—", platformOrderNo: "—", orderPayable: 0, consumptionAmount: 0, originFlowNo: "—",
    currency: baseCurrency, fundStatus: "已完成", orderPayStatus: "—", incomeEventStatus: "—", consistencyStatus: "一致",
    source: "人工调账", operator: "陈露", remark: "客服补偿调增", productFee: 0, logisticsFee: 0, designFee: 0, serviceFee: 0, otherFee: 25
  });

  var runningCustomerBalances = {};
  customerBalanceSnapshots.forEach(function (snapshot) {
    runningCustomerBalances[snapshot.customer + "::" + snapshot.currency] = snapshot.balance;
  });
  customerFlows.slice().sort(function (a, b) {
    return a.occurred.localeCompare(b.occurred) || a.flowNo.localeCompare(b.flowNo);
  }).forEach(function (flow) {
    var key = flow.customer + "::" + flow.currency;
    if (runningCustomerBalances[key] == null) return;
    flow.beforeBalance = round(runningCustomerBalances[key]);
    runningCustomerBalances[key] = round(runningCustomerBalances[key] + (flow.direction === "收入" ? flow.amount : -flow.amount));
    flow.afterBalance = runningCustomerBalances[key];
  });
  customerFlows.sort(function (a, b) {
    return b.occurred.localeCompare(a.occurred) || b.flowNo.localeCompare(a.flowNo);
  });

  var expenses = [];
  orders.forEach(function (order, i) {
    [
      [order.type === "售后单" ? "售后工厂成本" : "工厂成本", order.factoryCost, order.supplier],
      [order.type === "售后单" ? "售后物流成本" : "物流成本", order.logisticsCost, ["USPS", "UPS", "FedEx", "DHL"][i % 4]]
    ].forEach(function (row, j) {
      var factoryCost = j === 0;
      var eventNo = "EXP-20260813-" + pad(expenses.length + 1, 5);
      expenses.push({
        id: eventNo,
        eventNo: eventNo,
        occurred: dateText(i + j, i % 12),
        supplier: row[2],
        counterpartyType: factoryCost ? "工厂" : "物流商",
        counterparty: row[2],
        customer: order.customer,
        orderId: order.id,
        detailId: factoryCost ? order.detailId : "—",
        purchaseNo: factoryCost ? order.purchaseNo : "—",
        sku: factoryCost ? order.sku : "—",
        businessDocumentType: factoryCost ? "采购单" : "订单",
        businessDocumentNo: factoryCost ? order.purchaseNo : order.id,
        type: row[0],
        amount: round(row[1]),
        currency: order.currency,
        reconcileStatus: factoryCost ? order.reconciled : "待物流对账",
        settlementStatus: factoryCost ? order.settlement : "暂估不结算",
        source: factoryCost ? "采购单系统报价" : "面单预估成本",
        external: factoryCost ? i % 23 === 0 : false,
        operator: ["系统", "陈露", "周航"][i % 3]
      });
    });
  });

  var bills = suppliers.map(function (supplier, i) {
    var totalLines = 118 + i * 17;
    var diff = i === 1 ? 16 : 4 + i;
    var missing = i === 2 ? 11 : i % 2 ? 3 : 1;
    return {
      id: "BILL-202608-" + pad(i + 1, 4),
      supplier: supplier,
      supplierBillNo: "SUP-BILL-" + (20260800 + i + 1),
      period: "2026-08-01 ~ 2026-08-10",
      currency: currencies[i % currencies.length],
      totalLines: totalLines,
      totalAmount: round(8600 + i * 1240.55),
      autoMatched: totalLines - diff - missing - 5,
      amountDiff: diff,
      platformMissing: missing,
      unmatched: 5 + i,
      duplicated: i % 3,
      confirmed: 62 + i * 10,
      systemPayable: round(8300 + i * 1190.35),
      status: i === 0 ? "待人工处理" : i === 1 ? "对账中" : i === 2 ? "待结算" : i === 3 ? "已结算" : "已导入",
      importer: ["王敏", "李哲", "陈露"][i % 3],
      importedAt: dateText(i, 24 + i)
    };
  });

  var reconciliationLines = [
    makeLine(1, "自动匹配", 100, 100, "采购单 ID", "已确认", "场景 A：系统采购单 100，账单 100，自动匹配成功"),
    makeLine(2, "金额差异", 108, 100, "采购单 ID", "待处理", "场景 B：工厂账单 108，最终按系统金额 100 确认"),
    makeLine(3, "平台缺单", 76, 0, "未匹配", "待处理", "场景 C：工厂系统外部采购单，需人工关联订单详情"),
    makeLine(4, "自动匹配", 94, 94, "订单号 + SKU + 工厂 + 数量", "已确认", "场景 D：工厂不提供采购单 ID，组合条件唯一匹配"),
    makeLine(5, "未匹配", 126, 120, "多候选", "待处理", "场景 E：同订单 + SKU 存在作废与当前采购单，禁止自动选择"),
    makeLine(6, "重复", 88, 88, "重复行识别", "待处理", "重复账单明细"),
    makeLine(7, "系统缺账", 0, 112, "系统采购单", "待处理", "系统有采购单但工厂账单缺失")
  ];
  for (var r = 8; r <= 42; r += 1) {
    var status = ["自动匹配", "金额差异", "平台缺单", "未匹配", "重复", "已确认"][r % 6];
    var sys = 60 + (r % 11) * 8;
    var bill = status === "金额差异" ? sys + 6 + r % 5 : status === "平台缺单" ? sys : status === "系统缺账" ? 0 : sys;
    var matchMethod = status === "自动匹配" ? "采购单 ID" :
      status === "金额差异" ? "订单号 + SKU + 工厂 + 数量" :
        status === "平台缺单" ? "未匹配" :
          status === "未匹配" ? "多候选" :
            status === "重复" ? "重复行识别" : "人工匹配";
    reconciliationLines.push(makeLine(r, status, bill, status === "平台缺单" ? 0 : sys, matchMethod, status === "自动匹配" || status === "已确认" ? "已确认" : "待处理", ""));
  }

  function makeLine(i, matchStatus, billAmount, systemAmount, method, status, note) {
    var order = orders[(i * 7) % orders.length];
    return {
      lineNo: i,
      supplierOrderNo: "SUP-PO-" + pad(9000 + i, 5),
      platformOrderNo: order.id.replace("ORDER", "AMZ"),
      billSku: order.sku,
      attrs: ["Black / L", "White / M", "Blue / XL"][i % 3],
      qty: 1 + i % 5,
      billAmount: round(billAmount),
      systemPurchaseNo: matchStatus === "平台缺单" ? "—" : order.purchaseNo,
      systemOrderId: order.id,
      systemDetailId: order.detailId,
      systemSku: order.sku,
      systemAmount: round(systemAmount),
      diff: round(billAmount - systemAmount),
      method: method,
      matchEvidence: reconciliationMatchEvidence(matchStatus, method),
      matchStatus: matchStatus,
      status: status,
      reviewNote: note,
      supplier: order.supplier,
      currency: order.currency,
      shippedAt: order.shippedAt,
      candidates: [
        { po: order.purchaseNo, status: "已发货", supplier: order.supplier, sku: order.sku, qty: 1 + i % 5, shippedAt: order.shippedAt, voided: "否", created: order.created },
        { po: "PO-VOID-" + pad(7000 + i, 5), status: "已作废", supplier: order.supplier, sku: order.sku, qty: 1 + i % 5, shippedAt: "—", voided: "是", created: dateText(i, 72) }
      ]
    };
  }

  function reconciliationMatchEvidence(matchStatus, method) {
    if (matchStatus === "自动匹配") {
      return method === "采购单 ID" ? "采购单 ID 唯一命中" : "组合条件唯一命中";
    }
    if (matchStatus === "金额差异") return method + " 唯一命中，金额不一致";
    if (matchStatus === "平台缺单") return "未找到对应采购单";
    if (matchStatus === "未匹配") return "发现 2 个候选采购单";
    if (matchStatus === "重复") return "命中重复账单明细规则";
    if (matchStatus === "系统缺账") return "系统采购单未出现在账单";
    if (matchStatus === "已确认") return "已人工确认匹配";
    return "等待人工确认";
  }

  var settlements = bills.filter(function (bill) { return bill.status === "已结算"; }).map(function (bill, i) {
    var increaseAmount = i % 2 === 0 ? 120 : 0;
    var decreaseAmount = i % 2 === 0 ? 20 : 50;
    var payable = round(bill.systemPayable + increaseAmount - decreaseAmount);
    var paid = payable;
    return {
      id: "SET-202608-" + pad(i + 1, 4),
      supplier: bill.supplier,
      billId: bill.id,
      period: bill.period,
      currency: bill.currency,
      systemPayable: bill.systemPayable,
      increaseAmount: increaseAmount,
      decreaseAmount: decreaseAmount,
      adjustmentNote: increaseAmount ? "补计经财务确认的工艺附加费，扣减账单重复包装费。" : "扣减对账确认的重复费用。",
      payable: payable,
      paid: paid,
      unpaid: round(payable - paid),
      reconcileStatus: "已对账",
      settlementStatus: "已付款",
      creator: ["王敏", "李哲", "陈露"][i % 3],
      createdAt: dateText(i, 8 + i),
      updatedBy: ["王敏", "李哲", "陈露"][i % 3],
      updatedAt: dateText(i, 7 + i),
      paidAt: paid ? dateText(i, 2 + i) : "—"
    };
  });

  expenses.filter(function (expense) { return expense.counterpartyType === "工厂"; }).forEach(function (expense) {
    var bill = bills.find(function (item) { return item.supplier === expense.supplier; });
    expense.billId = bill ? bill.id : "—";
  });

  var logisticsCosts = orders.slice(0, 72).map(function (order, i) {
    var originalCurrency = logisticsCurrencies[Math.floor(i / 4) % logisticsCurrencies.length];
    var exchangeRate = exchangeRates[originalCurrency];
    var estimatedCost = round(order.logisticsCost / exchangeRate);
    var actualCost = i === 0 ? round(estimatedCost * 1.05) : i === 1 ? round(estimatedCost * 1.4167) : i % 13 === 0 ? round(estimatedCost * 1.46) : i % 7 === 0 ? round(estimatedCost * 1.24) : i % 9 === 0 ? 0 : round(estimatedCost * (1.03 + (i % 3) * 0.02));
    var costDiff = actualCost ? round(actualCost - estimatedCost) : 0;
    var diffRate = estimatedCost ? round(costDiff / estimatedCost * 100) : 0;
    var estimatedCostCny = round(estimatedCost * exchangeRate);
    var actualCostCny = actualCost ? round(actualCost * exchangeRate) : 0;
    var costDiffCny = actualCost ? round(actualCostCny - estimatedCostCny) : 0;
    return {
      orderId: order.id,
      labelNo: "LBL-" + pad(520000 + i, 6),
      tracking: "TRK" + (940028100000 + i * 41),
      carrier: ["USPS", "UPS", "FedEx", "DHL"][i % 4],
      rateCard: "RATE-" + originalCurrency + "-" + (i % 4 + 1),
      customerFee: round(order.logisticsIncome),
      customerFeeCurrency: baseCurrency,
      estimatedCost: estimatedCost,
      actualCost: actualCost,
      costDiff: costDiff,
      estimatedCostCny: estimatedCostCny,
      actualCostCny: actualCostCny,
      costDiffCny: costDiffCny,
      diffRate: diffRate,
      currency: originalCurrency,
      originalCurrency: originalCurrency,
      exchangeRate: exchangeRate,
      rateDate: "2026-08-10",
      rateSource: "财务月度记账汇率",
      baseCurrency: baseCurrency,
      sku: order.sku,
      qty: 1 + i % 5,
      supplier: order.supplier,
      country: ["US", "GB", "DE", "CA", "AU"][i % 5],
      estimatedWeight: round(0.3 + (i % 6) * 0.16),
      actualWeight: actualCost ? round(0.35 + (i % 6) * 0.2) : 0,
      billWeight: actualCost ? round(0.42 + (i % 6) * 0.24) : 0,
      createdAt: dateText(i, i % 20),
      shippedAt: order.shippedAt,
      actualBillStatus: actualCost ? "已匹配账单" : "无实际账单",
      anomalyLevel: !actualCost ? "未匹配" : diffRate > 40 && costDiffCny > 1 ? "严重异常" : diffRate > 20 && costDiffCny > 1 ? "中度异常" : diffRate > 10 && costDiffCny > 0.8 ? "轻微偏差" : "正常",
      status: i % 9 === 0 ? "待发货" : "已发货"
    };
  });

  logisticsCosts.forEach(function (cost) {
    var order = orders.find(function (item) { return item.id === cost.orderId; });
    var activeLogisticsCost = cost.actualCost ? cost.actualCostCny : cost.estimatedCostCny;
    order.estimatedLogisticsCostCny = cost.estimatedCostCny;
    order.actualLogisticsCostCny = cost.actualCost ? cost.actualCostCny : null;
    order.logisticsCost = activeLogisticsCost;
    order.logisticsOriginalCurrency = cost.originalCurrency;
    order.logisticsOriginalCost = cost.actualCost || cost.estimatedCost;
    order.logisticsExchangeRate = cost.exchangeRate;
    order.profitStatus = cost.actualCost ? "最终" : "暂估";
    order.afterCost = order.type === "售后单" ? round(order.factoryCost + activeLogisticsCost) : 0;
    order.originalGross = round(order.netIncome - order.factoryCost - activeLogisticsCost);
    order.gross = round(order.originalGross - order.afterCost);
    order.grossRate = order.netIncome ? round(order.gross / order.netIncome * 100) : -100;
    var logisticsExpense = expenses.find(function (expense) { return expense.orderId === order.id && expense.type.indexOf("物流") >= 0; });
    if (logisticsExpense) {
      logisticsExpense.amount = activeLogisticsCost;
      logisticsExpense.currency = baseCurrency;
      logisticsExpense.source = cost.actualCost ? "物流账单折算成本" : "面单预估成本（人民币）";
      logisticsExpense.reconcileStatus = cost.actualCost ? "已匹配物流账单" : "待物流对账";
      logisticsExpense.settlementStatus = cost.actualCost ? "待结算" : "暂估不结算";
    }
  });

  orders.slice(logisticsCosts.length).forEach(function (order) {
    order.estimatedLogisticsCostCny = order.logisticsCost;
    order.actualLogisticsCostCny = null;
    order.logisticsOriginalCurrency = baseCurrency;
    order.logisticsOriginalCost = order.logisticsCost;
    order.logisticsExchangeRate = 1;
    order.profitStatus = "暂估";
  });

  var logisticsBills = [];
  var logisticsBillIndex = 0;
  ["USPS", "UPS", "FedEx", "DHL"].forEach(function (carrier) {
    logisticsCurrencies.forEach(function (originalCurrency) {
      var rows = logisticsCosts.filter(function (l) { return l.carrier === carrier && l.originalCurrency === originalCurrency; });
      if (!rows.length) return;
      var matchedRows = rows.filter(function (r) { return r.actualCost; });
      var actualTotal = round(sum(matchedRows, function (r) { return r.actualCost; }));
      var estimatedTotal = round(sum(matchedRows, function (r) { return r.estimatedCost; }));
      var actualTotalCny = round(sum(matchedRows, function (r) { return r.actualCostCny; }));
      var estimatedTotalCny = round(sum(matchedRows, function (r) { return r.estimatedCostCny; }));
      var exchangeRate = exchangeRates[originalCurrency];
      var totalAmount = actualTotal;
      var abnormal = rows.filter(function (r) { return ["轻微偏差", "中度异常", "严重异常"].indexOf(r.anomalyLevel) >= 0; }).length;
      logisticsBillIndex += 1;
      var duplicated = logisticsBillIndex % 2;
      logisticsBills.push({
        id: "LBILL-202608-" + pad(logisticsBillIndex, 4),
        carrier: carrier,
        billNo: carrier + "-" + originalCurrency + "-202608-" + pad(logisticsBillIndex, 3),
        period: "2026-08-01 ~ 2026-08-10",
        currency: originalCurrency,
        originalCurrency: originalCurrency,
        exchangeRate: exchangeRate,
        rateDate: "2026-08-10",
        rateSource: "财务月度记账汇率",
        baseCurrency: baseCurrency,
        totalLines: rows.length,
        totalAmount: totalAmount,
        totalAmountCny: round(totalAmount * exchangeRate),
        autoMatched: Math.max(0, matchedRows.length - duplicated),
        unmatched: rows.length - matchedRows.length,
        duplicated: duplicated,
        costAbnormal: abnormal,
        estimatedTotal: estimatedTotal,
        actualTotal: actualTotal,
        diff: round(actualTotal - estimatedTotal),
        estimatedTotalCny: estimatedTotalCny,
        actualTotalCny: actualTotalCny,
        diffCny: round(actualTotalCny - estimatedTotalCny),
        status: logisticsBillIndex === 1 ? "已结算" : logisticsBillIndex % 4 === 1 ? "已完成" : logisticsBillIndex % 4 === 2 ? "待人工处理" : logisticsBillIndex % 4 === 3 ? "匹配中" : "已导入",
        importer: ["王敏", "李哲", "陈露", "周航"][(logisticsBillIndex - 1) % 4],
        importedAt: dateText(logisticsBillIndex - 1, 11 + logisticsBillIndex)
      });
    });
  });

  logisticsCosts.forEach(function (cost) {
    var bill = logisticsBills.find(function (item) {
      return item.carrier === cost.carrier && item.originalCurrency === cost.originalCurrency;
    });
    cost.billId = bill ? bill.id : "—";
    var expense = expenses.find(function (item) {
      return item.counterpartyType === "物流商" && item.orderId === cost.orderId;
    });
    if (expense) expense.billId = cost.billId;
  });

  var logisticsSettlements = logisticsBills.filter(function (bill) { return bill.status === "已结算"; }).map(function (bill, i) {
    var increaseAmount = bill.originalCurrency === "CNY" ? 20 : 3;
    var decreaseAmount = bill.originalCurrency === "CNY" ? 5 : 1;
    var systemPayable = bill.actualTotal;
    var payable = round(systemPayable + increaseAmount - decreaseAmount);
    return {
      id: "LSET-202608-" + pad(i + 1, 4),
      carrier: bill.carrier,
      billId: bill.id,
      period: bill.period,
      currency: bill.originalCurrency,
      originalCurrency: bill.originalCurrency,
      exchangeRate: bill.exchangeRate,
      rateDate: bill.rateDate,
      rateSource: bill.rateSource,
      baseCurrency: bill.baseCurrency,
      systemPayable: systemPayable,
      increaseAmount: increaseAmount,
      decreaseAmount: decreaseAmount,
      adjustmentNote: "补计偏远地区附加费，扣减重复计费。",
      payable: payable,
      payableCny: round(payable * bill.exchangeRate),
      paid: payable,
      unpaid: 0,
      reconcileStatus: "已完成",
      settlementStatus: "已付款",
      creator: "王敏",
      createdAt: dateText(i, 6 + i),
      updatedBy: "王敏",
      updatedAt: dateText(i, 5 + i),
      paidAt: dateText(i, 3 + i)
    };
  });

  var logisticsReconcileLines = logisticsCosts.map(function (l, i) {
    var matchStatus = !l.actualCost ? "未匹配" : i % 17 === 0 ? "重复" : l.anomalyLevel === "正常" ? "成本正常" : "成本异常";
    if (l.anomalyLevel === "严重异常") matchStatus = "严重偏差";
    if (i === 0) matchStatus = "自动匹配";
    var bill = logisticsBills.find(function (item) { return item.carrier === l.carrier && item.originalCurrency === l.originalCurrency; });
    return {
      lineNo: i + 1,
      billId: bill.id,
      tracking: l.tracking,
      orderId: l.orderId,
      labelNo: l.labelNo,
      sku: l.sku,
      qty: l.qty,
      supplier: l.supplier,
      channel: l.carrier,
      country: l.country,
      estimatedCost: l.estimatedCost,
      actualCost: l.actualCost,
      diff: l.costDiff,
      estimatedCostCny: l.estimatedCostCny,
      actualCostCny: l.actualCostCny,
      diffCny: l.costDiffCny,
      diffRate: l.diffRate,
      estimatedWeight: l.estimatedWeight,
      actualWeight: l.actualWeight,
      billWeight: l.billWeight,
      level: l.anomalyLevel,
      matchStatus: matchStatus,
      currency: l.originalCurrency,
      originalCurrency: l.originalCurrency,
      exchangeRate: l.exchangeRate,
      rateDate: l.rateDate,
      rateSource: l.rateSource,
      baseCurrency: l.baseCurrency,
      billDate: dateText(i, i % 10),
      raw: "base=" + (l.actualCost || 0) + "; currency=" + l.originalCurrency + "; zone=" + l.country + "; carrier=" + l.carrier
    };
  });

  var exceptions = [
    ["账单金额差异", "Factory B", orders[7].id, orders[7].purchaseNo, bills[1].id, 8, "待处理", "陈露"],
    ["平台缺单", "Factory C", orders[14].id, "—", bills[2].id, 76, "待处理", "未分配"],
    ["多采购单匹配", "Factory A", orders[35].id, orders[35].purchaseNo, bills[0].id, 6, "处理中", "王敏"],
    ["重复账单", "Factory D", orders[21].id, orders[21].purchaseNo, bills[3].id, 88, "待处理", "李哲"],
    ["系统有采购单、工厂账单缺失", "Factory E", orders[28].id, orders[28].purchaseNo, bills[4].id, 112, "待处理", "未分配"],
    ["外部补录采购单", "Factory C", orders[42].id, "EXT-PO-202608-0001", bills[2].id, 76, "已确认", "陈露"],
    ["长时间未对账", "Factory F", orders[56].id, orders[56].purchaseNo, bills[5].id, 132, "待处理", "周航"],
    ["长时间未结算", "Factory A", orders[63].id, orders[63].purchaseNo, bills[0].id, 420, "待处理", "王敏"]
  ].map(function (r, i) {
    return { id: "FIN-EXC-20260813-" + pad(i + 1, 4), type: r[0], supplier: r[1], orderId: r[2], purchaseNo: r[3], billId: r[4], amount: r[5], currency: baseCurrency, occurred: dateText(i, 20 + i), status: r[6], owner: r[7], updatedAt: dateText(i, i) };
  });
  logisticsReconcileLines.filter(function (l) { return l.matchStatus === "严重偏差" || l.matchStatus === "未匹配"; }).slice(0, 8).forEach(function (l, i) {
    exceptions.push({
      id: "FIN-LOG-EXC-20260813-" + pad(i + 1, 4),
      type: l.matchStatus === "未匹配" ? "物流账单未匹配" : "物流成本严重偏差",
      supplier: l.channel,
      orderId: l.orderId,
      purchaseNo: l.labelNo,
      billId: l.billId,
      amount: l.diffCny,
      currency: baseCurrency,
      originalAmount: l.diff,
      originalCurrency: l.originalCurrency,
      exchangeRate: l.exchangeRate,
      occurred: l.billDate,
      status: "待处理",
      owner: i % 2 ? "周航" : "未分配",
      updatedAt: dateText(i, i),
      tracking: l.tracking,
      risk: "疑似重量 / 包装 / 体积重 / 报价规则异常"
    });
  });

  function round(n) { return Math.round(Number(n || 0) * 100) / 100; }

  window.FINANCE_DATA = {
    baseCurrency: baseCurrency,
    asOfDate: asOfDate,
    logisticsCurrencies: logisticsCurrencies,
    exchangeRates: exchangeRates,
    customers: customers,
    suppliers: suppliers,
    currencies: currencies,
    skus: skus,
    orderTypes: orderTypes,
    incomeTypes: incomeTypes,
    expenseTypes: expenseTypes,
    orders: orders,
    incomes: incomes,
    customerBalanceSnapshots: customerBalanceSnapshots,
    customerFlows: customerFlows,
    expenses: expenses,
    bills: bills,
    reconciliationLines: reconciliationLines,
    settlements: settlements,
    logisticsCosts: logisticsCosts,
    logisticsBills: logisticsBills,
    logisticsSettlements: logisticsSettlements,
    logisticsReconcileLines: logisticsReconcileLines,
    exceptions: exceptions
  };

  function sum(list, fn) { return list.reduce(function (total, item) { return total + fn(item); }, 0); }
})();
