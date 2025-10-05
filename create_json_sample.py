#!/usr/bin/env python3
"""
Generate a sample JSON file from hospitalizacoes.parquet for web dashboard
This creates a manageable subset of data that can be loaded in the browser
"""

import pandas as pd
import json
import numpy as np

def create_json_sample():
    """Create a JSON sample from the parquet file"""
    
    parquet_path = "/home/vinicius/Documents/GitHub/TCC/docs/static/data/hospitalizacoes.parquet"
    json_path = "/home/vinicius/Documents/GitHub/TCC/docs/static/data/hospitalizacoes_sample.json"
    
    try:
        print("Loading parquet file...")
        df = pd.read_parquet(parquet_path)
        print(f"Loaded {len(df)} records")
        
        # Display available columns
        print(f"Available columns: {list(df.columns)}")
        print(f"Data types:")
        for col in df.columns:
            print(f"  {col}: {df[col].dtype}")
        
        # Take a sample for web performance
        sample_size = min(50000, len(df))  # Max 50k records for web
        df_sample = df.sample(n=sample_size, random_state=42)
        
        print(f"Creating sample with {len(df_sample)} records...")
        
        # Convert to JSON-serializable format
        # Handle NaN values and ensure proper types
        df_sample = df_sample.fillna('')
        
        # Convert to records format
        records = df_sample.to_dict('records')
        
        # Create the final JSON structure
        json_data = {
            "metadata": {
                "total_original_records": len(df),
                "sample_records": len(records),
                "columns": list(df.columns),
                "sample_created": pd.Timestamp.now().isoformat(),
                "data_types": {col: str(df[col].dtype) for col in df.columns}
            },
            "data": records
        }
        
        # Save to JSON
        print(f"Saving to {json_path}...")
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, ensure_ascii=False, indent=2)
        
        print(f"Successfully created JSON sample with {len(records)} records")
        
        # Also create a minimal version with just essential columns
        essential_columns = []
        for col in df.columns:
            col_lower = col.lower()
            if any(keyword in col_lower for keyword in ['ano', 'year', 'diag', 'munic', 'dist', 'hospital']):
                essential_columns.append(col)
        
        if essential_columns:
            df_minimal = df_sample[essential_columns]
            minimal_records = df_minimal.to_dict('records')
            
            minimal_json_path = "/home/vinicius/Documents/GitHub/TCC/docs/static/data/hospitalizacoes_minimal.json"
            minimal_data = {
                "metadata": {
                    "total_original_records": len(df),
                    "sample_records": len(minimal_records),
                    "columns": essential_columns,
                    "sample_created": pd.Timestamp.now().isoformat()
                },
                "data": minimal_records
            }
            
            with open(minimal_json_path, 'w', encoding='utf-8') as f:
                json.dump(minimal_data, f, ensure_ascii=False)
            
            print(f"Also created minimal version with {len(essential_columns)} columns: {minimal_json_path}")
        
        return True
        
    except Exception as e:
        print(f"Error creating JSON sample: {e}")
        return False

if __name__ == "__main__":
    success = create_json_sample()
    if success:
        print("\nJSON sample created successfully!")
        print("You can now use the dashboard with the generated JSON data.")
    else:
        print("Failed to create JSON sample.")