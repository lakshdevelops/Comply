# Legal Compliance App: Scope Analysis & Free Expansion Opportunities

## Executive Summary

This report analyzes the current scope of the Legal Compliance MCP Server and identifies free expansion opportunities using open government data sources and APIs.

---

## Current Scope

### 1. **US Federal Law Coverage**
- **Service**: `GovInfoService`
- **Data Source**: GovInfo API (https://api.govinfo.gov/)
- **Coverage**:
  - United States Code (USC) - All 54 titles
  - Code of Federal Regulations (CFR)
- **Features**:
  - Full-text search across USC and CFR
  - Title-specific searches
  - Granule-level text retrieval
  - Intelligent keyword-based title selection
  - HTML content extraction with Cheerio
- **Limitations**:
  - Requires free API key registration
  - Search endpoint has known limitations (USCODE collection indexing issues)
  - Falls back to keyword-based title matching
  - Limited to 20 results per query type

### 2. **Case Law Coverage**
- **Service**: `CourtListenerService`
- **Data Source**: CourtListener V4 API (Free Law Project)
- **Coverage**:
  - Federal and state court decisions
  - Supreme Court cases
  - Circuit court opinions
- **Features**:
  - Full-text case search
  - Court filtering (e.g., "scotus", "ca9", "ny")
  - Citation extraction
  - Precedential status tracking
  - Date-based ordering
- **Limitations**:
  - Requires free API token registration
  - Rate limits enforced (10 results per query)
  - V3 API deprecated (must use V4)

### 3. **EU Regulations Coverage**
- **Service**: `EURexService`
- **Data Source**: EUR-Lex Web Service (https://eur-lex.europa.eu/)
- **Coverage**:
  - GDPR (General Data Protection Regulation)
  - AI Act (Artificial Intelligence Act)
  - MiCA (Markets in Crypto-Assets Regulation)
  - Other EU regulations
- **Features**:
  - Direct CELEX number lookup
  - Regulation ID shortcuts ("gdpr", "ai-act", "mica")
  - HTML scraping with Cheerio
  - HTML to Markdown conversion (Turndown)
- **Limitations**:
  - No official API (web scraping required)
  - HTML structure dependency (may break if structure changes)
  - Limited to 10 results per search
  - Text extraction limited to 10,000 characters

### 4. **State Law Coverage**
- **Service**: `StateScraperService`
- **Data Sources**: Direct scraping of state legislature websites
- **Coverage**:
  - **California**: CCPA/CPRA (Civil Code 1798.100-1798.120)
  - **New York**: Financial regulations
  - **Illinois**: BIPA (Biometric Information Privacy Act, 740 ILCS 14)
- **Features**:
  - Keyword-based search
  - Hardcoded CCPA section links for reliability
  - HTML parsing with Cheerio
- **Limitations**:
  - Only 3 states covered (CA, NY, IL)
  - California uses JSF (JavaServer Faces) - difficult to scrape
  - Website structure changes break scrapers
  - Manual verification warnings when scraping fails
  - No unified 50-state API exists

---

## Architecture & Technical Stack

### Current Implementation
- **Protocol**: Model Context Protocol (MCP) Server
- **Transport**: stdio (designed for MCP clients like Cursor IDE)
- **Language**: TypeScript (ES2022 modules)
- **HTTP Client**: Axios with exponential backoff retry logic
- **HTML Parsing**: Cheerio
- **HTML to Markdown**: Turndown
- **Error Handling**: Graceful degradation with clear warnings

### Service Layer Pattern
- Each data source has a dedicated service class
- Centralized HTTP client with retry logic (1s, 2s, 4s delays)
- Consistent error handling across services
- Rate limit respect built-in

---

## Free Expansion Opportunities

### 1. **Additional US Federal Data Sources**

#### A. Congress.gov API (Free)
- **URL**: https://api.congress.gov/
- **Coverage**: 
  - Bills and resolutions
  - Congressional records
  - Committee reports
  - Member information
- **Use Case**: Track pending legislation, monitor regulatory changes
- **Implementation**: New service `CongressGovService`
- **API Key**: Free registration required
- **Endpoints**:
  - `/bill/{congress}/{billType}/{billNumber}`
  - `/bill/{congress}/{billType}/{billNumber}/text`
  - `/bill/{congress}/{billType}/{billNumber}/summaries`

#### B. Federal Register API (Free)
- **URL**: https://www.federalregister.gov/api/v1/
- **Coverage**:
  - Proposed and final rules
  - Presidential documents
  - Notices
  - Daily publication tracking
- **Use Case**: Monitor regulatory changes, track rulemaking
- **Implementation**: New service `FederalRegisterService`
- **API Key**: Free (no key required for basic access)
- **Endpoints**:
  - `/documents.json` - Search documents
  - `/documents/{document_number}.json` - Get full document

#### C. PACER (Public Access to Court Electronic Records)
- **Note**: Not free, but has free tier for certain queries
- **Alternative**: Use CourtListener (already integrated) which aggregates PACER data

#### D. SEC EDGAR API (Free)
- **URL**: https://www.sec.gov/edgar/sec-api-documentation
- **Coverage**:
  - Corporate filings
  - Financial disclosures
  - Regulatory compliance filings
- **Use Case**: Corporate compliance monitoring
- **Implementation**: New service `SECEdgarService`
- **API Key**: Free (no key required)
- **Endpoints**: RESTful API for company filings

### 2. **Additional State Law Sources**

#### A. Open States API (Free, but requires API key)
- **URL**: https://openstates.org/
- **Coverage**: All 50 states + DC
- **Features**:
  - Bills, votes, legislators
  - Committee information
  - Bill tracking
- **Use Case**: Expand beyond CA/NY/IL to all states
- **Implementation**: New service `OpenStatesService`
- **API Key**: Free registration required
- **Limitation**: Rate limits apply

#### B. State Legislature RSS Feeds (Free, no API key)
- **Coverage**: Many states provide RSS feeds for new legislation
- **Use Case**: Monitor new bills and regulations
- **Implementation**: RSS parser service
- **Examples**:
  - California: https://leginfo.legislature.ca.gov/faces/rssFeeds.xhtml
  - New York: Various RSS feeds available
  - Texas: https://capitol.texas.gov/RSS.aspx

#### C. State Code Direct Scraping (Free, no API key)
- **Additional States to Add**:
  - **Texas**: https://statutes.capitol.texas.gov/
  - **Florida**: https://www.flsenate.gov/Laws/Statutes
  - **Pennsylvania**: https://www.legis.state.pa.us/
  - **Massachusetts**: https://malegislature.gov/Laws/GeneralLaws
- **Implementation**: Extend `StateScraperService` with new methods
- **Challenge**: Each state has different website structure

### 3. **International Law Sources**

#### A. UK Legislation API (Free)
- **URL**: https://www.legislation.gov.uk/api
- **Coverage**: UK Acts, Statutory Instruments, EU-derived legislation
- **Use Case**: UK compliance for international businesses
- **Implementation**: New service `UKLegislationService`
- **API Key**: Free (no key required)
- **Endpoints**: RESTful API with JSON responses

#### B. Canadian Legal Information Institute (CanLII) API (Free)
- **URL**: https://www.canlii.org/en/api/
- **Coverage**: Canadian case law, legislation, regulations
- **Use Case**: Canadian compliance
- **Implementation**: New service `CanLIIService`
- **API Key**: Free registration required
- **Endpoints**: RESTful API

#### C. Australian Legal Information Institute (AustLII) (Free, web scraping)
- **URL**: https://www.austlii.edu.au/
- **Coverage**: Australian case law, legislation
- **Use Case**: Australian compliance
- **Implementation**: New service `AustLIIService`
- **Note**: No official API, requires web scraping

### 4. **Regulatory Agency APIs**

#### A. FDA API (Free)
- **URL**: https://open.fda.gov/
- **Coverage**: Drug approvals, medical devices, food recalls
- **Use Case**: Healthcare/pharma compliance
- **Implementation**: New service `FDAService`
- **API Key**: Free (no key required)

#### B. EPA API (Free)
- **URL**: https://www.epa.gov/developers/data-data-products
- **Coverage**: Environmental regulations, enforcement actions
- **Use Case**: Environmental compliance
- **Implementation**: New service `EPAService`
- **API Key**: Varies by endpoint

#### C. OSHA API (Free)
- **URL**: https://www.osha.gov/data
- **Coverage**: Workplace safety regulations, enforcement data
- **Use Case**: Workplace safety compliance
- **Implementation**: New service `OSHAService`
- **Note**: Limited API, may require web scraping

### 5. **Data.gov Catalog Integration (Free)**
- **URL**: https://www.data.gov/
- **Coverage**: Centralized catalog of all US government open data
- **Use Case**: Discover new legal/compliance datasets
- **Implementation**: Metadata service to discover available datasets
- **API Key**: Free (no key required)
- **Endpoints**: CKAN API for dataset discovery

### 6. **Enhanced Features (No New APIs Required)**

#### A. Legal Citation Parser
- **Use Case**: Extract and validate legal citations from text
- **Implementation**: Regex-based parser for common citation formats
- **Examples**: "15 U.S.C. § 45", "740 ILCS 14", "GDPR Art. 25"

#### B. Regulation Change Tracking
- **Use Case**: Monitor changes to regulations over time
- **Implementation**: 
  - Cache regulation versions
  - Compare versions using diff algorithms
  - Track modification dates from GovInfo/EUR-Lex

#### C. Compliance Checklist Generator
- **Use Case**: Generate compliance checklists based on regulations
- **Implementation**: 
  - Parse regulation text
  - Extract requirements using NLP (simple keyword matching)
  - Generate structured checklist format

#### D. Cross-Reference Mapper
- **Use Case**: Map relationships between regulations
- **Implementation**:
  - Extract citation references from regulation text
  - Build graph of regulation relationships
  - Visualize connections

#### E. Multi-Jurisdiction Search
- **Use Case**: Search across all jurisdictions simultaneously
- **Implementation**: 
  - Parallel API calls to all services
  - Aggregate results
  - Deduplicate and rank

---

## Implementation Priority Recommendations

### High Priority (Easy Wins)
1. **Federal Register API** - Free, no key required, high-value regulatory data
2. **Congress.gov API** - Free, tracks pending legislation
3. **UK Legislation API** - Free, no key required, international coverage
4. **Legal Citation Parser** - No API needed, enhances existing functionality

### Medium Priority (Moderate Effort)
1. **Open States API** - Expands state coverage to all 50 states
2. **SEC EDGAR API** - Corporate compliance use case
3. **State RSS Feed Parser** - Monitor new legislation
4. **Regulation Change Tracking** - Uses existing APIs, adds value

### Low Priority (Higher Effort)
1. **Additional State Scrapers** - Each state requires custom implementation
2. **CanLII/AustLII** - International coverage, may require scraping
3. **FDA/EPA/OSHA APIs** - Industry-specific, lower general demand
4. **Compliance Checklist Generator** - Requires NLP capabilities

---

## Technical Considerations

### Rate Limiting
- All free APIs have rate limits
- Current retry logic should handle transient failures
- Consider implementing request queuing for bulk operations

### Data Caching
- Consider caching frequently accessed regulations
- Implement TTL-based cache invalidation
- Use cache to reduce API calls and improve performance

### Error Handling
- Maintain current graceful degradation approach
- Add specific error messages for each new service
- Continue manual verification warnings for scrapers

### Service Architecture
- Follow existing service pattern for new services
- Use centralized HTTP client
- Maintain consistent response formats

### Testing
- Add integration tests for new services
- Mock API responses for unit tests
- Test rate limit handling

---

## Cost Analysis

### Current Costs
- **GovInfo API**: Free (requires registration)
- **CourtListener API**: Free (requires registration)
- **EUR-Lex**: Free (public website)
- **State Scrapers**: Free (public websites)
- **Infrastructure**: None (runs as MCP server)

### Expansion Costs
- **All recommended expansions**: $0 (all use free APIs or public data)
- **Infrastructure**: No additional cost (same MCP server model)
- **Development Time**: Only cost is development effort

---

## Conclusion

The Legal Compliance MCP Server has a solid foundation covering:
- US Federal law (USC/CFR)
- Case law (CourtListener)
- EU regulations (EUR-Lex)
- 3 high-risk US states (CA, NY, IL)

**Free expansion opportunities are abundant**, with the highest-value additions being:
1. Federal Register API (regulatory change tracking)
2. Congress.gov API (pending legislation)
3. Open States API (50-state coverage)
4. UK Legislation API (international coverage)

All recommended expansions use **free government APIs** or **public data sources**, maintaining the app's commitment to free/open data sources.

The modular service architecture makes adding new data sources straightforward, following the existing pattern of dedicated service classes with centralized HTTP client and error handling.

