import yaml
import psycopg2
import os
import json
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def sync_schemes():
    # Database configuration
    db_url = os.environ.get("DATABASE_URL", "postgresql://krishi:krishi123@postgres:5432/krishidb")
    # For local execution outside docker, we might need a different host
    if "postgres" not in os.environ.get("HOSTNAME", "") and "ml-service" not in os.environ.get("HOSTNAME", ""):
        db_url = db_url.replace("@postgres:", "@localhost:")

    yaml_path = os.path.join(os.path.dirname(__file__), "..", "..", "data", "schemes.yaml")
    
    try:
        with open(yaml_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
            schemes = data.get('schemes', [])
            
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        # Ensure table exists (though init.sql should have created it)
        # But we'll do it anyway to be safe during this repair
        cur.execute("""
            CREATE TABLE IF NOT EXISTS schemes (
                scheme_id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                name_hi VARCHAR(255),
                name_mr VARCHAR(255),
                description TEXT,
                description_hi TEXT,
                description_mr TEXT,
                benefit_estimate DECIMAL(12, 2),
                benefit_type VARCHAR(50),
                eligibility_rules JSONB NOT NULL,
                required_documents TEXT[] DEFAULT '{}',
                category VARCHAR(100),
                department VARCHAR(255),
                state VARCHAR(100),
                is_active BOOLEAN DEFAULT TRUE,
                priority_weight DECIMAL(3, 2) DEFAULT 1.0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        for s in schemes:
            logger.info(f"Syncing scheme: {s['scheme_id']}")
            
            # Map YAML fields to DB columns
            cur.execute("""
                INSERT INTO schemes (
                    scheme_id, name, name_hi, name_mr, description, 
                    benefit_estimate, eligibility_rules, required_documents, 
                    category, priority_weight
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (scheme_id) DO UPDATE SET
                    name = EXCLUDED.name,
                    name_hi = EXCLUDED.name_hi,
                    name_mr = EXCLUDED.name_mr,
                    description = EXCLUDED.description,
                    benefit_estimate = EXCLUDED.benefit_estimate,
                    eligibility_rules = EXCLUDED.eligibility_rules,
                    required_documents = EXCLUDED.required_documents,
                    category = EXCLUDED.category,
                    priority_weight = EXCLUDED.priority_weight,
                    updated_at = CURRENT_TIMESTAMP
            """, (
                s['scheme_id'],
                s['name'],
                s.get('name_hi'),
                s.get('name_mr'),
                s.get('description'),
                s.get('max_benefit'), # Mapping max_benefit to benefit_estimate
                json.dumps(s.get('rules', [])),
                s.get('required_documents', []),
                s.get('category'),
                s.get('priority_weight', 1.0)
            ))
            
        conn.commit()
        cur.close()
        conn.close()
        logger.info(f"Successfully synced {len(schemes)} schemes to database")
        
    except Exception as e:
        logger.error(f"Error syncing schemes: {e}")
        raise

if __name__ == "__main__":
    sync_schemes()
